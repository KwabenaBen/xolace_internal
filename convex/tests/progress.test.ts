import { afterEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { toDateOnly } from "../lib/dates";
import { isLateExtension } from "../lib/lateRule";
import type { TaskStatus } from "../lib/validators";
import { createTestConvex, expectAppError, insertUser, type TestConvex } from "../test.setup";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const inDays = (days: number) => toDateOnly(Date.now() + days * DAY);

afterEach(() => {
  vi.useRealTimers();
});

/** Only the clock is faked, so convex-test's own timers keep working. */
function setClock(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

async function setup() {
  const t = createTestConvex();
  const coo = await insertUser(t, { email: "coo@cadence.test", role: "admin", title: "COO" });
  const cmo = await insertUser(t, { email: "cmo@cadence.test", role: "admin", title: "CMO" });
  const ceo = await insertUser(t, { email: "ceo@cadence.test", role: "member", title: "CEO" });
  const cto = await insertUser(t, { email: "cto@cadence.test", role: "member", title: "CTO" });
  // The CEO verifies admins' work, and decides extensions on admins' tasks.
  await coo.asUser.mutation(api.settings.set, {
    key: "adminTaskReviewer",
    value: { email: "ceo@cadence.test", userId: ceo.userId },
  });
  const featureId = await coo.asUser.mutation(api.features.create, {
    title: "Onboarding flow",
    description: "New users can sign up and finish setup.",
    expectedResult: "Most invited users finish onboarding.",
    sourceNote: "",
    deadline: inDays(20),
  });
  return { t, coo, cmo, ceo, cto, featureId };
}

async function createTask(
  t: TestConvex,
  asAdmin: ReturnType<TestConvex["withIdentity"]>,
  featureId: Id<"features">,
  ownerId: Id<"users">,
  days = 10
) {
  return await asAdmin.mutation(api.tasks.create, {
    featureId,
    title: "Write the welcome copy",
    description: "",
    kind: "content",
    acceptanceCriteria: ["Three screens of copy"],
    ownerId,
    deadline: inDays(days),
    priority: "medium",
  });
}

async function setStatus(t: TestConvex, taskId: Id<"tasks">, status: TaskStatus) {
  await t.run(async (ctx) => ctx.db.patch("tasks", taskId, { status }));
}

async function getTask(t: TestConvex, taskId: Id<"tasks">) {
  return await t.run(async (ctx) => ctx.db.get("tasks", taskId));
}

describe("owners' updates", () => {
  test("the owner moves their task and sets its progress; nobody else can", async () => {
    const { t, coo, ceo, cto, featureId } = await setup();
    const taskId = await createTask(t, coo.asUser, featureId, cto.userId);

    await cto.asUser.mutation(api.tasks.postUpdate, {
      taskId,
      status: "in_progress",
      progress: 40,
      note: "Two of three screens drafted",
    });
    expect(await getTask(t, taskId)).toMatchObject({ status: "in_progress", progress: 40 });

    await expectAppError(
      ceo.asUser.mutation(api.tasks.postUpdate, { taskId, status: "todo", progress: 0 }),
      "FORBIDDEN"
    );
    // Admins plan; they don't post updates on someone else's work.
    await expectAppError(
      coo.asUser.mutation(api.tasks.postUpdate, { taskId, status: "todo", progress: 0 }),
      "FORBIDDEN"
    );

    const history = await ceo.asUser.query(api.activity.forTask, { taskId });
    // Starting it moved the feature on (Planned → In progress), and that shows here too.
    expect(history[0]).toMatchObject({
      action: "feature.status_changed",
      after: { status: "in_progress" },
    });
    expect(history[1]).toMatchObject({
      action: "task.update_posted",
      before: { status: "todo", progress: 0 },
      after: { status: "in_progress", progress: 40, note: "Two of three screens drafted" },
      actor: { title: "CTO" },
      task: { _id: taskId },
    });
    // The task's creation, logged before it, is in its history too.
    expect(history.at(-1)?.action).toBe("task.created");
  });

  test("blocked needs a reason; progress is a whole number from 0 to 100", async () => {
    const { t, coo, cto, featureId } = await setup();
    const taskId = await createTask(t, coo.asUser, featureId, cto.userId);
    const as = cto.asUser;

    await expectAppError(
      as.mutation(api.tasks.postUpdate, { taskId, status: "blocked", progress: 10 }),
      "INVALID_ARGUMENT"
    );
    await as.mutation(api.tasks.postUpdate, {
      taskId,
      status: "blocked",
      progress: 10,
      note: "Waiting for the brand guide",
    });
    // Already blocked: a progress change needs no new reason.
    await as.mutation(api.tasks.postUpdate, { taskId, status: "blocked", progress: 15 });

    for (const progress of [-5, 101, 12.5]) {
      await expectAppError(
        as.mutation(api.tasks.postUpdate, { taskId, status: "in_progress", progress }),
        "INVALID_ARGUMENT"
      );
    }
  });

  test("nothing changed and no note: nothing is logged", async () => {
    const { t, coo, cto, featureId } = await setup();
    const taskId = await createTask(t, coo.asUser, featureId, cto.userId);
    await cto.asUser.mutation(api.tasks.postUpdate, { taskId, status: "todo", progress: 0 });
    const history = await cto.asUser.query(api.activity.forTask, { taskId });
    expect(history.map((h) => h.action)).toEqual(["task.created"]);
  });

  test("with its reviewer or verified it's locked; sent back, it's the owner's again", async () => {
    const { t, coo, cto, featureId } = await setup();
    const taskId = await createTask(t, coo.asUser, featureId, cto.userId);
    for (const status of ["in_peer_review", "submitted", "verified"] as const) {
      await setStatus(t, taskId, status);
      await expectAppError(
        cto.asUser.mutation(api.tasks.postUpdate, { taskId, status: "in_progress", progress: 50 }),
        "INVALID_ARGUMENT"
      );
    }
    await setStatus(t, taskId, "changes_requested");
    await cto.asUser.mutation(api.tasks.postUpdate, {
      taskId,
      status: "in_progress",
      progress: 80,
    });
    expect(await getTask(t, taskId)).toMatchObject({ status: "in_progress", progress: 80 });
  });

  test("an admin who owns a task updates it like anyone else", async () => {
    const { t, coo, featureId } = await setup();
    const taskId = await createTask(t, coo.asUser, featureId, coo.userId);
    await coo.asUser.mutation(api.tasks.postUpdate, { taskId, status: "in_progress", progress: 5 });
    expect(await getTask(t, taskId)).toMatchObject({ status: "in_progress" });
  });
});

describe("comments", () => {
  test("anyone comments on any task; they show in its history", async () => {
    const { t, coo, ceo, cto, featureId } = await setup();
    const taskId = await createTask(t, coo.asUser, featureId, cto.userId);
    await ceo.asUser.mutation(api.comments.add, { taskId, body: "  Keep it short.  " });

    const history = await cto.asUser.query(api.activity.forTask, { taskId });
    expect(history[0]).toMatchObject({
      action: "comment.added",
      after: { body: "Keep it short." },
      actor: { title: "CEO" },
    });
    await expectAppError(
      ceo.asUser.mutation(api.comments.add, { taskId, body: "   " }),
      "INVALID_ARGUMENT"
    );
  });

  test("a declined proposal is closed to comments", async () => {
    const { coo, ceo, featureId } = await setup();
    const taskId = await ceo.asUser.mutation(api.tasks.propose, {
      featureId,
      title: "Add a referral screen",
      description: "Let people invite friends.",
      kind: "design",
      acceptanceCriteria: [],
      priority: "low",
    });
    await ceo.asUser.mutation(api.comments.add, { taskId, body: "Happy to draw it." });
    await coo.asUser.mutation(api.tasks.declineProposal, { taskId, reason: "Not for v1" });
    await expectAppError(
      ceo.asUser.mutation(api.comments.add, { taskId, body: "Next version?" }),
      "INVALID_ARGUMENT"
    );
  });
});

describe("extension requests", () => {
  test("only the owner asks, for a later date, one request at a time", async () => {
    const { t, coo, ceo, cto, featureId } = await setup();
    const taskId = await createTask(t, coo.asUser, featureId, cto.userId, 10);
    const ask = {
      taskId,
      newDeadline: inDays(14),
      type: "scope_change" as const,
      reason: "Two more screens agreed",
    };

    await expectAppError(ceo.asUser.mutation(api.extensions.request, ask), "FORBIDDEN");
    await expectAppError(
      cto.asUser.mutation(api.extensions.request, { ...ask, newDeadline: inDays(9) }),
      "INVALID_ARGUMENT"
    );
    await expectAppError(
      cto.asUser.mutation(api.extensions.request, { ...ask, reason: "  " }),
      "INVALID_ARGUMENT"
    );
    await cto.asUser.mutation(api.extensions.request, ask);
    await expectAppError(cto.asUser.mutation(api.extensions.request, ask), "CONFLICT");

    const history = await ceo.asUser.query(api.activity.forTask, { taskId });
    expect(history[0]).toMatchObject({
      action: "extension.requested",
      after: {
        type: "scope_change",
        reason: "Two more screens agreed",
        beyondFeatureDeadline: false,
      },
    });
  });

  test("admins decide a member's request; a scope change asked early isn't late", async () => {
    setClock("2026-11-10T09:00:00Z");
    const { t, coo, ceo, cto, featureId } = await setup();
    const taskId = await createTask(t, coo.asUser, featureId, cto.userId, 10);
    const before = await getTask(t, taskId);
    const requestId = await cto.asUser.mutation(api.extensions.request, {
      taskId,
      newDeadline: inDays(14),
      type: "scope_change",
      reason: "Two more screens agreed in the sync",
    });

    // Another member, and the owner, can't decide.
    await expectAppError(
      ceo.asUser.mutation(api.extensions.decide, { requestId, approve: true }),
      "FORBIDDEN"
    );
    await expectAppError(
      cto.asUser.mutation(api.extensions.decide, { requestId, approve: true }),
      "FORBIDDEN"
    );
    const forAdmin = await coo.asUser.query(api.extensions.pending, {});
    const forMember = await ceo.asUser.query(api.extensions.pending, {});
    expect(forAdmin.map((p) => p.canDecide)).toEqual([true]);
    // Everyone sees it waiting; only the decider may answer it.
    expect(forMember.map((p) => p.canDecide)).toEqual([false]);
    const view = await cto.asUser.query(api.extensions.forTask, { taskId });
    expect(view).toMatchObject({ canDecide: false, decider: { kind: "admins" } });

    await coo.asUser.mutation(api.extensions.decide, { requestId, approve: true });
    const after = await getTask(t, taskId);
    expect(after?.deadline).toBeGreaterThan(before?.deadline ?? 0);
    expect(after?.originalDeadline).toBe(before?.originalDeadline);
    expect(after?.countsAsLate).toBe(false);
    await expectAppError(
      coo.asUser.mutation(api.extensions.decide, { requestId, approve: false, note: "x" }),
      "CONFLICT"
    );
  });

  test("declining needs a reason and leaves the deadline", async () => {
    const { t, coo, cto, featureId } = await setup();
    const taskId = await createTask(t, coo.asUser, featureId, cto.userId, 10);
    const before = await getTask(t, taskId);
    const requestId = await cto.asUser.mutation(api.extensions.request, {
      taskId,
      newDeadline: inDays(12),
      type: "other",
      reason: "Out sick two days",
    });
    await expectAppError(
      coo.asUser.mutation(api.extensions.decide, { requestId, approve: false }),
      "INVALID_ARGUMENT"
    );
    await coo.asUser.mutation(api.extensions.decide, {
      requestId,
      approve: false,
      note: "The launch date is fixed",
    });
    expect((await getTask(t, taskId))?.deadline).toBe(before?.deadline);
    // Decided, so they can ask again.
    await cto.asUser.mutation(api.extensions.request, {
      taskId,
      newDeadline: inDays(11),
      type: "other",
      reason: "One day, then",
    });
  });

  test("an admin's own task: the admin task reviewer decides, not another admin", async () => {
    const { t, coo, cmo, ceo, featureId } = await setup();
    const taskId = await createTask(t, cmo.asUser, featureId, coo.userId, 10);
    const requestId = await coo.asUser.mutation(api.extensions.request, {
      taskId,
      newDeadline: inDays(13),
      type: "other",
      reason: "Partner meeting moved",
    });
    await expectAppError(
      cmo.asUser.mutation(api.extensions.decide, { requestId, approve: true }),
      "FORBIDDEN"
    );
    await expectAppError(
      coo.asUser.mutation(api.extensions.decide, { requestId, approve: true }),
      "FORBIDDEN"
    );
    expect(await ceo.asUser.query(api.extensions.forTask, { taskId })).toMatchObject({
      canDecide: true,
      decider: { kind: "reviewer", name: "ceo", isOwner: false },
      canRequest: true,
    });
    await ceo.asUser.mutation(api.extensions.decide, { requestId, approve: true });
    // "Other" is always late.
    expect((await getTask(t, taskId))?.countsAsLate).toBe(true);
  });

  test("a scope change asked within the late window counts as late, and stays late", async () => {
    setClock("2026-11-10T09:00:00Z");
    const { t, coo, cto, featureId } = await setup();
    const taskId = await createTask(t, coo.asUser, featureId, cto.userId, 3); // ends 13 Nov
    // 13 Nov, 08:00 GMT: under 24 hours before the deadline.
    setClock("2026-11-13T08:00:00Z");
    const requestId = await cto.asUser.mutation(api.extensions.request, {
      taskId,
      newDeadline: "2026-11-16",
      type: "scope_change",
      reason: "New screen added",
    });
    await coo.asUser.mutation(api.extensions.decide, { requestId, approve: true });
    expect((await getTask(t, taskId))?.countsAsLate).toBe(true);

    // A later, early scope change doesn't make it on time again.
    const second = await cto.asUser.mutation(api.extensions.request, {
      taskId,
      newDeadline: "2026-11-18",
      type: "scope_change",
      reason: "Another screen",
    });
    await coo.asUser.mutation(api.extensions.decide, { requestId: second, approve: true });
    expect((await getTask(t, taskId))?.countsAsLate).toBe(true);
  });

  test("a date past the feature's deadline moves the feature too when approved", async () => {
    const { t, coo, cto, featureId } = await setup(); // feature ends in 20 days
    const taskId = await createTask(t, coo.asUser, featureId, cto.userId, 18);
    const requestId = await cto.asUser.mutation(api.extensions.request, {
      taskId,
      newDeadline: inDays(25),
      type: "scope_change",
      reason: "Bigger than planned",
    });
    const view = await coo.asUser.query(api.extensions.forTask, { taskId });
    expect(view.requests[0]).toMatchObject({ beyondFeatureDeadline: true, status: "pending" });

    await coo.asUser.mutation(api.extensions.decide, { requestId, approve: true });
    const task = await getTask(t, taskId);
    const feature = await t.run(async (ctx) => ctx.db.get("features", featureId));
    expect(feature?.deadline).toBe(task?.deadline);
    const history = await coo.asUser.query(api.activity.forTask, { taskId });
    expect(history.map((h) => h.action)).toContain("feature.deadline_extended");
  });

  test("no requests while the task is with its reviewer", async () => {
    const { t, coo, cto, featureId } = await setup();
    const taskId = await createTask(t, coo.asUser, featureId, cto.userId, 10);
    await setStatus(t, taskId, "submitted");
    await expectAppError(
      cto.asUser.mutation(api.extensions.request, {
        taskId,
        newDeadline: inDays(12),
        type: "other",
        reason: "x",
      }),
      "INVALID_ARGUMENT"
    );
  });
});

describe("overdue", () => {
  test("the job flags unverified tasks past their deadline once; an extension clears it", async () => {
    setClock("2026-11-10T09:00:00Z");
    const { t, coo, cto, featureId } = await setup();
    const late = await createTask(t, coo.asUser, featureId, cto.userId, 1); // ends 11 Nov
    const done = await createTask(t, coo.asUser, featureId, cto.userId, 1);
    const fine = await createTask(t, coo.asUser, featureId, cto.userId, 5);
    await setStatus(t, done, "verified");

    setClock("2026-11-12T00:05:00Z");
    expect(await t.mutation(internal.overdue.flag, {})).toBe(1);
    expect((await getTask(t, late))?.overdueSince).toBeDefined();
    expect((await getTask(t, done))?.overdueSince).toBeUndefined();
    expect((await getTask(t, fine))?.overdueSince).toBeUndefined();
    expect(await t.mutation(internal.overdue.flag, {})).toBe(0);

    const history = await cto.asUser.query(api.activity.forTask, { taskId: late });
    expect(history[0]).toMatchObject({ action: "task.became_overdue", actor: null });

    const requestId = await cto.asUser.mutation(api.extensions.request, {
      taskId: late,
      newDeadline: "2026-11-14",
      type: "scope_change",
      reason: "Scope grew",
    });
    await coo.asUser.mutation(api.extensions.decide, { requestId, approve: true });
    const extended = await getTask(t, late);
    expect(extended?.overdueSince).toBeUndefined();
    // Asked after the deadline had passed: late.
    expect(extended?.countsAsLate).toBe(true);
  });
});

describe("extension requests: the audit's cases", () => {
  test("a request doesn't follow the task to a new owner, and nobody decides their own", async () => {
    const { t, coo, cmo, ceo, cto, featureId } = await setup();
    // The COO owns a task and asks; then hands the task to the CTO.
    const taskId = await createTask(t, cmo.asUser, featureId, coo.userId, 10);
    const requestId = await coo.asUser.mutation(api.extensions.request, {
      taskId,
      newDeadline: inDays(14),
      type: "scope_change",
      reason: "Bigger than planned",
    });
    const task = await getTask(t, taskId);
    await coo.asUser.mutation(api.tasks.update, {
      taskId,
      title: task!.title,
      description: task!.description,
      kind: task!.kind,
      acceptanceCriteria: task!.acceptanceCriteria,
      ownerId: cto.userId,
      deadline: toDateOnly(task!.deadline!),
      priority: task!.priority,
    });
    const closed = await t.run(async (ctx) => ctx.db.get("extensionRequests", requestId));
    expect(closed).toMatchObject({
      status: "withdrawn",
      decisionNote: "The task moved to a new owner.",
    });
    // Closed, so nobody can approve it, the COO least of all.
    for (const who of [coo, ceo]) {
      await expectAppError(
        who.asUser.mutation(api.extensions.decide, { requestId, approve: true }),
        "CONFLICT"
      );
    }

    // Even if a request were still waiting after the task changed hands, its asker can't
    // decide it, and nobody can approve it for the new owner.
    const other = await createTask(t, cmo.asUser, featureId, coo.userId, 10);
    const stale = await coo.asUser.mutation(api.extensions.request, {
      taskId: other,
      newDeadline: inDays(13),
      type: "other",
      reason: "Partner moved",
    });
    await t.run(async (ctx) => ctx.db.patch("tasks", other, { ownerId: cto.userId }));
    await expectAppError(
      coo.asUser.mutation(api.extensions.decide, { requestId: stale, approve: true }),
      "FORBIDDEN"
    );
    await expectAppError(
      cmo.asUser.mutation(api.extensions.decide, { requestId: stale, approve: true }),
      "INVALID_ARGUMENT"
    );
  });

  test("approving needs the task in its owner's hands and the feature not shipped", async () => {
    const { t, coo, cto, featureId } = await setup();
    const taskId = await createTask(t, coo.asUser, featureId, cto.userId, 10);
    const ask = async () =>
      await cto.asUser.mutation(api.extensions.request, {
        taskId,
        newDeadline: inDays(12),
        type: "scope_change",
        reason: "More screens",
      });
    const first = await ask();
    await setStatus(t, taskId, "submitted");
    await expectAppError(
      coo.asUser.mutation(api.extensions.decide, { requestId: first, approve: true }),
      "INVALID_ARGUMENT"
    );
    // Declining still works.
    await coo.asUser.mutation(api.extensions.decide, {
      requestId: first,
      approve: false,
      note: "Submitted already",
    });

    await setStatus(t, taskId, "in_progress");
    const second = await ask();
    await t.run(async (ctx) => ctx.db.patch("features", featureId, { status: "shipped" }));
    await expectAppError(
      coo.asUser.mutation(api.extensions.decide, { requestId: second, approve: true }),
      "INVALID_ARGUMENT"
    );
  });

  test("approving refuses a date that has passed or a deadline that already moved", async () => {
    setClock("2026-11-10T09:00:00Z");
    const { t, coo, cto, featureId } = await setup();
    const taskId = await createTask(t, coo.asUser, featureId, cto.userId, 2); // ends 12 Nov
    const requestId = await cto.asUser.mutation(api.extensions.request, {
      taskId,
      newDeadline: "2026-11-13",
      type: "scope_change",
      reason: "One more day",
    });
    setClock("2026-11-14T09:00:00Z");
    await expectAppError(
      coo.asUser.mutation(api.extensions.decide, { requestId, approve: true }),
      "INVALID_ARGUMENT"
    );
    await coo.asUser.mutation(api.extensions.decide, {
      requestId,
      approve: false,
      note: "Too late",
    });

    setClock("2026-11-10T09:00:00Z");
    const later = await cto.asUser.mutation(api.extensions.request, {
      taskId,
      newDeadline: "2026-11-15",
      type: "scope_change",
      reason: "Three more days",
    });
    // Meanwhile an admin moves the deadline past it.
    await t.run(async (ctx) =>
      ctx.db.patch("tasks", taskId, { deadline: Date.parse("2026-11-16T23:59:59.999Z") })
    );
    await expectAppError(
      coo.asUser.mutation(api.extensions.decide, { requestId: later, approve: true }),
      "INVALID_ARGUMENT"
    );
  });

  test("the late window is the one in force when they asked", async () => {
    setClock("2026-11-10T09:00:00Z");
    const { t, coo, cto, featureId } = await setup();
    await coo.asUser.mutation(api.settings.set, { key: "extensionLateWindowHours", value: 72 });
    const taskId = await createTask(t, coo.asUser, featureId, cto.userId, 2); // ends 12 Nov, under 72 h
    const requestId = await cto.asUser.mutation(api.extensions.request, {
      taskId,
      newDeadline: "2026-11-15",
      type: "scope_change",
      reason: "Scope grew",
    });
    // Narrowing the window afterwards doesn't change the verdict.
    await coo.asUser.mutation(api.settings.set, { key: "extensionLateWindowHours", value: 6 });
    await coo.asUser.mutation(api.extensions.decide, { requestId, approve: true });
    expect((await getTask(t, taskId))?.countsAsLate).toBe(true);
  });

  test("no request when nobody could decide it; the asker can withdraw", async () => {
    const { t, coo, cmo, ceo, cto, featureId } = await setup();
    const adminTask = await createTask(t, cmo.asUser, featureId, coo.userId, 10);
    // The reviewer (the CEO) is deactivated: the other admin (the CMO) decides instead.
    await t.run(async (ctx) => ctx.db.patch("users", ceo.userId, { isActive: false }));
    const fallback = await coo.asUser.mutation(api.extensions.request, {
      taskId: adminTask,
      newDeadline: inDays(12),
      type: "other",
      reason: "Partner moved the date",
    });
    expect(await cmo.asUser.query(api.extensions.forTask, { taskId: adminTask })).toMatchObject({
      canDecide: true,
      decider: { kind: "admins" },
    });
    await cmo.asUser.mutation(api.extensions.decide, { requestId: fallback, approve: true });
    // With no reviewer and no other admin, nobody could decide: asking is refused.
    await t.run(async (ctx) => ctx.db.patch("users", cmo.userId, { isActive: false }));
    await expectAppError(
      coo.asUser.mutation(api.extensions.request, {
        taskId: adminTask,
        newDeadline: inDays(14),
        type: "other",
        reason: "x",
      }),
      "INVALID_ARGUMENT"
    );
    await t.run(async (ctx) => ctx.db.patch("users", cmo.userId, { isActive: true }));

    const taskId = await createTask(t, coo.asUser, featureId, cto.userId, 10);
    const requestId = await cto.asUser.mutation(api.extensions.request, {
      taskId,
      newDeadline: inDays(12),
      type: "other",
      reason: "Changed my mind later",
    });
    await expectAppError(cmo.asUser.mutation(api.extensions.withdraw, { requestId }), "FORBIDDEN");
    await cto.asUser.mutation(api.extensions.withdraw, { requestId });
    const history = await cto.asUser.query(api.activity.forTask, { taskId });
    expect(history[0]?.action).toBe("extension.withdrawn");
    // Withdrawn, so they can ask again.
    await cto.asUser.mutation(api.extensions.request, {
      taskId,
      newDeadline: inDays(11),
      type: "other",
      reason: "One day",
    });
  });

  test("no requests on proposals, or from anyone but the owner", async () => {
    const { coo, ceo, cto, featureId, t } = await setup();
    const proposal = await ceo.asUser.mutation(api.tasks.propose, {
      featureId,
      title: "Referral screen",
      description: "Invite friends.",
      kind: "design",
      acceptanceCriteria: [],
      priority: "low",
    });
    await expectAppError(
      ceo.asUser.mutation(api.extensions.request, {
        taskId: proposal,
        newDeadline: inDays(5),
        type: "other",
        reason: "x",
      }),
      "INVALID_ARGUMENT"
    );
    const taskId = await createTask(t, coo.asUser, featureId, cto.userId, 10);
    await expectAppError(
      coo.asUser.mutation(api.extensions.request, {
        taskId,
        newDeadline: inDays(12),
        type: "other",
        reason: "x",
      }),
      "FORBIDDEN"
    );
  });

  test("signed-out and deactivated callers are turned away", async () => {
    const { t, coo, cto, featureId } = await setup();
    const taskId = await createTask(t, coo.asUser, featureId, cto.userId, 10);
    await expectAppError(
      t.mutation(api.tasks.postUpdate, { taskId, status: "todo", progress: 0 }),
      "UNAUTHENTICATED"
    );
    await expectAppError(t.mutation(api.comments.add, { taskId, body: "hi" }), "UNAUTHENTICATED");
    await expectAppError(t.query(api.activity.forTask, { taskId }), "UNAUTHENTICATED");
    await expectAppError(t.query(api.extensions.pending, {}), "UNAUTHENTICATED");
    await expectAppError(t.query(api.extensions.forTask, { taskId }), "UNAUTHENTICATED");
    await t.run(async (ctx) => ctx.db.patch("users", cto.userId, { isActive: false }));
    await expectAppError(
      cto.asUser.mutation(api.extensions.request, {
        taskId,
        newDeadline: inDays(12),
        type: "other",
        reason: "x",
      }),
      "ACCOUNT_INACTIVE"
    );
  });
});

describe("overdue: the audit's cases", () => {
  test("tasks with their reviewer are flagged too; an admin's later deadline clears it", async () => {
    setClock("2026-11-10T09:00:00Z");
    const { t, coo, cto, featureId } = await setup();
    const ids = [];
    for (const status of ["in_peer_review", "submitted", "changes_requested"] as const) {
      const id = await createTask(t, coo.asUser, featureId, cto.userId, 1);
      await setStatus(t, id, status);
      ids.push(id);
    }
    setClock("2026-11-12T00:05:00Z");
    expect(await t.mutation(internal.overdue.flag, {})).toBe(3);

    const changed = ids[2]; // changes requested: its plan can be edited
    const task = await getTask(t, changed);
    await coo.asUser.mutation(api.tasks.update, {
      taskId: changed,
      title: task!.title,
      description: task!.description,
      kind: task!.kind,
      acceptanceCriteria: task!.acceptanceCriteria,
      ownerId: cto.userId,
      deadline: "2026-11-15",
      priority: task!.priority,
      // Started (sent back) and overdue: moving it later says why, and counts as late.
      deadlineChangeType: "scope_change",
    });
    const moved = await getTask(t, changed);
    expect(moved?.overdueSince).toBeUndefined();
    expect(moved?.countsAsLate).toBe(true);
  });
});

describe("a reviewer who hasn't joined yet", () => {
  test("members see the rule without the invited person's email", async () => {
    const t = createTestConvex();
    const { asUser: asAdmin } = await insertUser(t, { email: "coo@cadence.test", role: "admin" });
    const { asUser: asMember } = await insertUser(t, { email: "cto@cadence.test", role: "member" });
    await t.run(async (ctx) =>
      ctx.db.insert("settings", {
        key: "adminTaskReviewer",
        value: { email: "ceo@cadence.test" },
        updatedAt: Date.now(),
      })
    );
    const reviewer = (rules: { key: string; value: unknown }[]) =>
      rules.find((r) => r.key === "adminTaskReviewer")?.value;
    expect(reviewer(await asAdmin.query(api.settings.list, {}))).toEqual({
      email: "ceo@cadence.test",
    });
    expect(reviewer(await asMember.query(api.settings.list, {}))).toEqual({ email: "" });
  });
});

describe("the activity feed", () => {
  test("everyone reads it, newest first; invites are for admins' eyes only", async () => {
    const { t, coo, ceo, cto, featureId } = await setup();
    await coo.asUser.mutation(api.invites.create, {
      email: "designer@cadence.test",
      role: "member",
      title: "Designer",
    });
    const taskId = await createTask(t, coo.asUser, featureId, cto.userId);
    await cto.asUser.mutation(api.comments.add, { taskId, body: "On it." });

    const page = { numItems: 50, cursor: null };
    const asAdmin = await coo.asUser.query(api.activity.feed, { paginationOpts: page });
    const asMember = await ceo.asUser.query(api.activity.feed, { paginationOpts: page });
    expect(asAdmin.page.some((e) => e.entityType === "invite")).toBe(true);
    expect(asMember.page.some((e) => e.entityType === "invite")).toBe(false);
    expect(asMember.page[0]).toMatchObject({ action: "comment.added", task: { _id: taskId } });

    const byCto = await coo.asUser.query(api.activity.feed, {
      paginationOpts: page,
      actorId: cto.userId,
    });
    expect(byCto.page.map((e) => e.action)).toEqual(["comment.added"]);
    await expectAppError(t.query(api.activity.feed, { paginationOpts: page }), "UNAUTHENTICATED");
  });
});

describe("the late rule", () => {
  const deadline = Date.parse("2026-11-13T23:59:59.999Z");
  test("other is always late; a scope change only inside the window", () => {
    const early = deadline - 3 * DAY;
    const close = deadline - 2 * HOUR;
    expect(
      isLateExtension({
        type: "other",
        requestedAt: early,
        currentDeadline: deadline,
        windowHours: 24,
      })
    ).toBe(true);
    expect(
      isLateExtension({
        type: "scope_change",
        requestedAt: early,
        currentDeadline: deadline,
        windowHours: 24,
      })
    ).toBe(false);
    expect(
      isLateExtension({
        type: "scope_change",
        requestedAt: close,
        currentDeadline: deadline,
        windowHours: 24,
      })
    ).toBe(true);
    expect(
      isLateExtension({
        type: "scope_change",
        requestedAt: close,
        currentDeadline: deadline,
        windowHours: 1,
      })
    ).toBe(false);
    expect(
      isLateExtension({
        type: "scope_change",
        requestedAt: deadline + HOUR,
        currentDeadline: deadline,
        windowHours: 0,
      })
    ).toBe(true);
  });
});
