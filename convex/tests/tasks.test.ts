import { afterEach, describe, expect, test, vi } from "vitest";

import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { toDateOnly } from "../lib/dates";
import type { TaskKind } from "../lib/validators";
import { createTestConvex, expectAppError, insertUser, type TestConvex } from "../test.setup";

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => toDateOnly(Date.now() + days * DAY);

afterEach(() => {
  vi.useRealTimers();
});

async function setup() {
  const t = createTestConvex();
  const admin = await insertUser(t, { email: "coo@cadence.test", role: "admin", title: "COO" });
  const ceo = await insertUser(t, { email: "ceo@cadence.test", role: "member", title: "CEO" });
  const cto = await insertUser(t, { email: "cto@cadence.test", role: "member", title: "CTO" });
  return { t, admin, ceo, cto };
}

async function createFeature(
  t: TestConvex,
  asAdmin: ReturnType<TestConvex["withIdentity"]>,
  days = 30
) {
  return await asAdmin.mutation(api.features.create, {
    title: "Onboarding flow",
    description: "New users can sign up and finish setup.",
    expectedResult: "80% of invited users complete onboarding.",
    sourceNote: "Weekly sync, 3 Nov",
    deadline: inDays(days),
  });
}

function codeTask(
  featureId: Id<"features">,
  ownerId: Id<"users">,
  peerReviewerId: Id<"users"> | undefined,
  days = 10
) {
  return {
    featureId,
    title: "Build the sign-up API",
    description: "",
    kind: "code" as TaskKind,
    acceptanceCriteria: [
      "Rejects uninvited emails",
      "  ",
      "Creates the user with the invite's role",
    ],
    ownerId,
    peerReviewerId,
    deadline: inDays(days),
    priority: "high" as const,
  };
}

describe("features", () => {
  test("admins create and edit features; members can't", async () => {
    const { t, admin, ceo } = await setup();
    const featureId = await createFeature(t, admin.asUser);

    const feature = await ceo.asUser.query(api.features.get, { featureId });
    expect(feature?.feature).toMatchObject({ title: "Onboarding flow", status: "planned" });
    expect(feature?.createdBy?.title).toBe("COO");

    await expectAppError(
      ceo.asUser.mutation(api.features.create, {
        title: "x",
        description: "x",
        expectedResult: "x",
        sourceNote: "",
        deadline: inDays(5),
      }),
      "FORBIDDEN"
    );
    await expectAppError(
      ceo.asUser.mutation(api.features.update, {
        featureId,
        title: "Renamed",
        description: "x",
        expectedResult: "x",
        sourceNote: "",
        deadline: inDays(30),
      }),
      "FORBIDDEN"
    );
  });

  test("feature deadlines can't be past, and can't move before a task's deadline", async () => {
    const { t, admin, ceo, cto } = await setup();
    await expectAppError(createFeature(t, admin.asUser, -1), "INVALID_ARGUMENT");

    const featureId = await createFeature(t, admin.asUser, 30);
    await admin.asUser.mutation(api.tasks.create, codeTask(featureId, ceo.userId, cto.userId, 20));

    const edit = (days: number) =>
      admin.asUser.mutation(api.features.update, {
        featureId,
        title: "Onboarding flow",
        description: "New users can sign up and finish setup.",
        expectedResult: "80% of invited users complete onboarding.",
        sourceNote: "Weekly sync, 3 Nov",
        deadline: inDays(days),
      });
    await expectAppError(edit(15), "INVALID_ARGUMENT");
    await edit(25);

    const activity = await t.run(async (ctx) => ctx.db.query("activity").collect());
    expect(activity.map((a) => a.action)).toEqual(
      expect.arrayContaining(["feature.created", "feature.updated", "task.created"])
    );
  });
});

describe("creating and editing tasks", () => {
  test("admins create live tasks with a fixed original deadline", async () => {
    const { t, admin, ceo, cto } = await setup();
    const featureId = await createFeature(t, admin.asUser);
    const taskId = await admin.asUser.mutation(
      api.tasks.create,
      codeTask(featureId, ceo.userId, cto.userId)
    );

    const view = await cto.asUser.query(api.tasks.get, { taskId });
    expect(view?.task).toMatchObject({
      status: "todo",
      progress: 0,
      kind: "code",
      acceptanceCriteria: ["Rejects uninvited emails", "Creates the user with the invite's role"],
    });
    expect(view?.task.originalDeadline).toBe(view?.task.deadline);
    expect(view?.task.owner?.title).toBe("CEO");
    expect(view?.task.peerReviewer?.title).toBe("CTO");
  });

  test("members can't create or edit tasks", async () => {
    const { t, admin, ceo, cto } = await setup();
    const featureId = await createFeature(t, admin.asUser);
    await expectAppError(
      ceo.asUser.mutation(api.tasks.create, codeTask(featureId, ceo.userId, cto.userId)),
      "FORBIDDEN"
    );
    const taskId = await admin.asUser.mutation(
      api.tasks.create,
      codeTask(featureId, ceo.userId, cto.userId)
    );
    const { featureId: _omit, ...plan } = codeTask(featureId, ceo.userId, cto.userId);
    await expectAppError(
      ceo.asUser.mutation(api.tasks.update, { taskId, ...plan, deadline: inDays(25) }),
      "FORBIDDEN"
    );
  });

  test("task rules: reviewer for code, reviewer isn't owner, active people, deadlines, criteria", async () => {
    const { t, admin, ceo, cto } = await setup();
    const inactive = await insertUser(t, {
      email: "gone@cadence.test",
      role: "member",
      isActive: false,
    });
    const featureId = await createFeature(t, admin.asUser, 30);
    const create = (overrides: Partial<ReturnType<typeof codeTask>>) =>
      admin.asUser.mutation(api.tasks.create, {
        ...codeTask(featureId, ceo.userId, cto.userId),
        ...overrides,
      });

    await expectAppError(create({ peerReviewerId: undefined }), "INVALID_ARGUMENT");
    await expectAppError(create({ peerReviewerId: ceo.userId }), "INVALID_ARGUMENT");
    await expectAppError(create({ ownerId: inactive.userId }), "INVALID_ARGUMENT");
    await expectAppError(create({ deadline: inDays(31) }), "INVALID_ARGUMENT"); // after feature
    await expectAppError(create({ deadline: inDays(-1) }), "INVALID_ARGUMENT"); // past
    await expectAppError(create({ deadline: "2026-02-30" }), "INVALID_ARGUMENT"); // not a date
    await expectAppError(create({ acceptanceCriteria: [" ", ""] }), "INVALID_ARGUMENT");
    await expectAppError(create({ title: "   " }), "INVALID_ARGUMENT");

    // Non-code tasks don't need a reviewer, and any reviewer given is dropped.
    const taskId = await create({ kind: "design", peerReviewerId: cto.userId });
    const view = await admin.asUser.query(api.tasks.get, { taskId });
    expect(view?.task.peerReviewerId).toBeUndefined();
  });

  test("an overdue task can still be edited if its deadline is left unchanged", async () => {
    const { t, admin, ceo, cto } = await setup();
    const featureId = await createFeature(t, admin.asUser, 30);
    const plan = codeTask(featureId, ceo.userId, cto.userId, 5);
    const taskId = await admin.asUser.mutation(api.tasks.create, plan);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 10 * DAY); // the task is now 5 days overdue
    const { featureId: _omit, ...edit } = plan;
    await admin.asUser.mutation(api.tasks.update, { taskId, ...edit, priority: "urgent" });
    const view = await admin.asUser.query(api.tasks.get, { taskId });
    expect(view?.task.priority).toBe("urgent");
  });
});

describe("proposals", () => {
  async function propose(
    t: TestConvex,
    as: ReturnType<TestConvex["withIdentity"]>,
    featureId: Id<"features">
  ) {
    return await as.mutation(api.tasks.propose, {
      featureId,
      title: "Add a referral link",
      description: "Let users invite friends from settings.",
      kind: "code",
      acceptanceCriteria: ["Link is copyable"],
      priority: "medium",
    });
  }

  test("a member's proposal waits off the board until an admin approves it", async () => {
    const { t, admin, ceo, cto } = await setup();
    const featureId = await createFeature(t, admin.asUser);
    const taskId = await propose(t, ceo.asUser, featureId);

    const proposed = await ceo.asUser.query(api.tasks.get, { taskId });
    expect(proposed?.task).toMatchObject({ status: "proposed", proposedBy: ceo.userId });
    expect(proposed?.task.ownerId).toBeUndefined();
    expect((await ceo.asUser.query(api.tasks.mine, {})).proposals).toHaveLength(1);
    expect((await admin.asUser.query(api.tasks.proposals, {})).proposals).toHaveLength(1);
    const boardBefore = await ceo.asUser.query(api.tasks.board, {});
    expect(boardBefore.flatMap((g) => g.tasks)).toHaveLength(0);

    const { featureId: _omit, ...plan } = codeTask(featureId, cto.userId, ceo.userId);
    await expectAppError(
      ceo.asUser.mutation(api.tasks.approveProposal, { taskId, ...plan }),
      "FORBIDDEN"
    );
    await admin.asUser.mutation(api.tasks.approveProposal, { taskId, ...plan });

    const approved = await ceo.asUser.query(api.tasks.get, { taskId });
    expect(approved?.task).toMatchObject({ status: "todo", ownerId: cto.userId });
    expect(approved?.task.proposer?.title).toBe("CEO");
    expect(approved?.task.originalDeadline).toBe(approved?.task.deadline);
    const boardAfter = await ceo.asUser.query(api.tasks.board, {});
    expect(boardAfter.flatMap((g) => g.tasks).map((x) => x._id)).toEqual([taskId]);
    expect((await admin.asUser.query(api.tasks.proposals, {})).proposals).toHaveLength(0);
  });

  test("a declined proposal keeps its reason and can't be approved later", async () => {
    const { t, admin, ceo, cto } = await setup();
    const featureId = await createFeature(t, admin.asUser);
    const taskId = await propose(t, ceo.asUser, featureId);

    await expectAppError(
      admin.asUser.mutation(api.tasks.declineProposal, { taskId, reason: "  " }),
      "INVALID_ARGUMENT"
    );
    await admin.asUser.mutation(api.tasks.declineProposal, {
      taskId,
      reason: "Out of scope for v1.",
    });

    const mine = await ceo.asUser.query(api.tasks.mine, {});
    expect(mine.proposals[0]).toMatchObject({
      status: "declined",
      declineReason: "Out of scope for v1.",
    });
    const { featureId: _omit, ...plan } = codeTask(featureId, cto.userId, ceo.userId);
    await expectAppError(
      admin.asUser.mutation(api.tasks.approveProposal, { taskId, ...plan }),
      "INVALID_ARGUMENT"
    );
    const board = await ceo.asUser.query(api.tasks.board, {});
    expect(board.flatMap((g) => g.tasks)).toHaveLength(0);
  });
});

describe("the board", () => {
  test("groups live tasks by feature and filters by owner, feature and status", async () => {
    const { t, admin, ceo, cto } = await setup();
    const onboarding = await createFeature(t, admin.asUser, 30);
    const partners = await admin.asUser.mutation(api.features.create, {
      title: "Partner deals",
      description: "Sign two payment partners.",
      expectedResult: "Two signed MoUs.",
      sourceNote: "",
      deadline: inDays(40),
    });
    const empty = await admin.asUser.mutation(api.features.create, {
      title: "Later idea",
      description: "Not planned yet.",
      expectedResult: "TBD.",
      sourceNote: "",
      deadline: inDays(60),
    });

    const apiTask = await admin.asUser.mutation(
      api.tasks.create,
      codeTask(onboarding, ceo.userId, cto.userId, 10)
    );
    const designTask = await admin.asUser.mutation(api.tasks.create, {
      ...codeTask(onboarding, cto.userId, undefined, 5),
      kind: "design",
      title: "Design the screens",
    });
    const opsTask = await admin.asUser.mutation(api.tasks.create, {
      ...codeTask(partners, admin.userId, undefined, 12),
      kind: "operations",
      title: "Shortlist banks",
    });

    const all = await ceo.asUser.query(api.tasks.board, {});
    expect(all.map((g) => g.feature._id)).toEqual([onboarding, partners, empty]);
    // Sorted by deadline within a feature.
    expect(all[0].tasks.map((x) => x._id)).toEqual([designTask, apiTask]);
    expect(all[2].tasks).toHaveLength(0);

    const ctoOnly = await ceo.asUser.query(api.tasks.board, { ownerId: cto.userId });
    expect(ctoOnly.map((g) => g.feature._id)).toEqual([onboarding]);
    expect(ctoOnly[0].tasks.map((x) => x._id)).toEqual([designTask]);

    const partnersOnly = await ceo.asUser.query(api.tasks.board, { featureId: partners });
    expect(partnersOnly.flatMap((g) => g.tasks).map((x) => x._id)).toEqual([opsTask]);

    const todo = await ceo.asUser.query(api.tasks.board, { status: "todo" });
    expect(todo.flatMap((g) => g.tasks)).toHaveLength(3);
    const blocked = await ceo.asUser.query(api.tasks.board, { status: "blocked" });
    expect(blocked).toHaveLength(0);
  });
});

describe("links with bad ids", () => {
  test("a malformed or wrong-table id returns null instead of throwing", async () => {
    const t = createTestConvex();
    const { asUser } = await insertUser(t, { email: "ceo@cadence.test", role: "member" });
    const { userId } = await insertUser(t, { email: "cto@cadence.test", role: "member" });

    expect(await asUser.query(api.tasks.get, { taskId: "not-an-id" })).toBeNull();
    expect(await asUser.query(api.features.get, { featureId: "abc" })).toBeNull();
    // A real id from another table.
    expect(await asUser.query(api.tasks.get, { taskId: userId })).toBeNull();
    expect(await asUser.query(api.features.get, { featureId: userId })).toBeNull();
  });
});

describe("edit rules (audit batch 3)", () => {
  function withoutFeature<T extends { featureId: unknown }>(plan: T): Omit<T, "featureId"> {
    const { featureId: _omit, ...rest } = plan;
    return rest;
  }

  test("a task's plan locks once it's in peer review, submitted or verified", async () => {
    const { t, admin, ceo, cto } = await setup();
    const featureId = await createFeature(t, admin.asUser);
    const plan = codeTask(featureId, ceo.userId, cto.userId);
    const taskId = await admin.asUser.mutation(api.tasks.create, plan);
    const edit = { taskId, ...withoutFeature(plan), priority: "urgent" as const };

    for (const status of ["in_peer_review", "submitted", "verified"] as const) {
      await t.run(async (ctx) => ctx.db.patch("tasks", taskId, { status }));
      await expectAppError(admin.asUser.mutation(api.tasks.update, edit), "INVALID_ARGUMENT");
    }
    await t.run(async (ctx) => ctx.db.patch("tasks", taskId, { status: "changes_requested" }));
    await admin.asUser.mutation(api.tasks.update, edit);
  });

  test("an admin can't move the deadline of a task they own; another admin can", async () => {
    const { t, admin } = await setup();
    const other = await insertUser(t, { email: "ceo2@cadence.test", role: "admin", title: "CEO" });
    const featureId = await createFeature(t, admin.asUser);
    const plan = { ...codeTask(featureId, admin.userId, other.userId), kind: "design" as TaskKind };
    const taskId = await admin.asUser.mutation(api.tasks.create, plan);
    const later = { taskId, ...withoutFeature(plan), deadline: inDays(20) };

    await expectAppError(admin.asUser.mutation(api.tasks.update, later), "FORBIDDEN");
    // Everything else about their own task can still change.
    await admin.asUser.mutation(api.tasks.update, {
      taskId,
      ...withoutFeature(plan),
      priority: "low",
    });
    expect((await admin.asUser.query(api.tasks.get, { taskId }))?.task.priority).toBe("low");

    await other.asUser.mutation(api.tasks.update, later);
    const view = await admin.asUser.query(api.tasks.get, { taskId });
    expect(view?.task.deadline).not.toBe(view?.task.originalDeadline);
  });

  test("edits keep the deadline on or before the feature's, and not in the past", async () => {
    const { t, admin, ceo, cto } = await setup();
    const featureId = await createFeature(t, admin.asUser, 30);
    const plan = codeTask(featureId, ceo.userId, cto.userId);
    const taskId = await admin.asUser.mutation(api.tasks.create, plan);
    const edit = { taskId, ...withoutFeature(plan) };

    await expectAppError(
      admin.asUser.mutation(api.tasks.update, { ...edit, deadline: inDays(40) }),
      "INVALID_ARGUMENT"
    );
    await expectAppError(
      admin.asUser.mutation(api.tasks.update, { ...edit, deadline: inDays(-2) }),
      "INVALID_ARGUMENT"
    );
  });

  test("only proposals are approved or declined, and proposals aren't edited", async () => {
    const { t, admin, ceo, cto } = await setup();
    const featureId = await createFeature(t, admin.asUser);
    const plan = codeTask(featureId, ceo.userId, cto.userId);
    const liveId = await admin.asUser.mutation(api.tasks.create, plan);
    const proposalId = await ceo.asUser.mutation(api.tasks.propose, {
      featureId,
      title: "Dark mode",
      description: "Follow the phone's setting.",
      kind: "design",
      acceptanceCriteria: [],
      priority: "low",
    });

    await expectAppError(
      admin.asUser.mutation(api.tasks.approveProposal, { taskId: liveId, ...withoutFeature(plan) }),
      "INVALID_ARGUMENT"
    );
    await expectAppError(
      admin.asUser.mutation(api.tasks.declineProposal, { taskId: liveId, reason: "No" }),
      "INVALID_ARGUMENT"
    );
    await expectAppError(
      admin.asUser.mutation(api.tasks.update, { taskId: proposalId, ...withoutFeature(plan) }),
      "INVALID_ARGUMENT"
    );
    await expectAppError(
      cto.asUser.mutation(api.tasks.declineProposal, { taskId: proposalId, reason: "No" }),
      "FORBIDDEN"
    );
  });

  test("a shipped feature takes no new tasks or proposals", async () => {
    const { t, admin, ceo, cto } = await setup();
    const featureId = await createFeature(t, admin.asUser);
    await t.run(async (ctx) => ctx.db.patch("features", featureId, { status: "shipped" }));

    await expectAppError(
      admin.asUser.mutation(api.tasks.create, codeTask(featureId, ceo.userId, cto.userId)),
      "INVALID_ARGUMENT"
    );
    await expectAppError(
      ceo.asUser.mutation(api.tasks.propose, {
        featureId,
        title: "Late idea",
        description: "Too late for this one.",
        kind: "other",
        acceptanceCriteria: [],
        priority: "low",
      }),
      "INVALID_ARGUMENT"
    );
  });

  test("the board leaves shipped features out unless one is picked; the waiting count", async () => {
    const { t, admin, ceo, cto } = await setup();
    const liveFeature = await createFeature(t, admin.asUser, 20);
    const doneFeature = await createFeature(t, admin.asUser, 30);
    await admin.asUser.mutation(api.tasks.create, codeTask(doneFeature, ceo.userId, cto.userId));
    await t.run(async (ctx) => ctx.db.patch("features", doneFeature, { status: "shipped" }));
    await ceo.asUser.mutation(api.tasks.propose, {
      featureId: liveFeature,
      title: "An idea",
      description: "Worth a look.",
      kind: "other",
      acceptanceCriteria: [],
      priority: "low",
    });

    const board = await ceo.asUser.query(api.tasks.board, {});
    expect(board.map((g) => g.feature._id)).toEqual([liveFeature]);
    const picked = await ceo.asUser.query(api.tasks.board, { featureId: doneFeature });
    expect(picked[0].tasks).toHaveLength(1);
    expect(await ceo.asUser.query(api.tasks.waitingCount, {})).toBe(1);
  });

  test("a deactivated member can't read the board or a task", async () => {
    const { t, admin, ceo, cto } = await setup();
    const featureId = await createFeature(t, admin.asUser);
    const taskId = await admin.asUser.mutation(
      api.tasks.create,
      codeTask(featureId, ceo.userId, cto.userId)
    );
    await t.run(async (ctx) => ctx.db.patch("users", cto.userId, { isActive: false }));

    await expectAppError(cto.asUser.query(api.tasks.board, {}), "ACCOUNT_INACTIVE");
    await expectAppError(cto.asUser.query(api.tasks.get, { taskId }), "ACCOUNT_INACTIVE");
  });
});
