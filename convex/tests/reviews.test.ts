import { afterEach, describe, expect, test, vi } from "vitest";

import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { toDateOnly } from "../lib/dates";
import { createTestConvex, expectAppError, insertUser, type TestConvex } from "../test.setup";

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => toDateOnly(Date.now() + days * DAY);

afterEach(() => {
  vi.useRealTimers();
});

/** Two admins (COO, CMO), two members (CEO: the admin task reviewer; CTO), one feature. */
async function setup() {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-12T10:00:00Z"));
  const t = createTestConvex();
  const coo = await insertUser(t, { email: "coo@cadence.test", role: "admin", title: "COO" });
  const cmo = await insertUser(t, { email: "cmo@cadence.test", role: "admin", title: "CMO" });
  const ceo = await insertUser(t, { email: "ceo@cadence.test", role: "member", title: "CEO" });
  const cto = await insertUser(t, { email: "cto@cadence.test", role: "member", title: "CTO" });
  await coo.asUser.mutation(api.settings.set, {
    key: "adminTaskReviewer",
    value: { email: "ceo@cadence.test", userId: ceo.userId },
  });
  const featureId = await coo.asUser.mutation(api.features.create, {
    title: "Onboarding flow",
    description: "New users can sign up.",
    expectedResult: "Most invited users finish onboarding.",
    sourceNote: "",
    deadline: inDays(30),
  });
  return { t, coo, cmo, ceo, cto, featureId };
}

type Client = Awaited<ReturnType<typeof setup>>["coo"]["asUser"];

async function codeTask(
  asAdmin: Client,
  featureId: Id<"features">,
  ownerId: Id<"users">,
  peerReviewerId: Id<"users">
) {
  return await asAdmin.mutation(api.tasks.create, {
    featureId,
    title: "Sign-up API",
    description: "",
    kind: "code",
    acceptanceCriteria: ["Rejects a wrong code", "Accepts the right one"],
    ownerId,
    peerReviewerId,
    deadline: inDays(10),
    priority: "high",
  });
}

async function contentTask(asAdmin: Client, featureId: Id<"features">, ownerId: Id<"users">) {
  return await asAdmin.mutation(api.tasks.create, {
    featureId,
    title: "Welcome copy",
    description: "",
    kind: "content",
    acceptanceCriteria: ["Three screens"],
    ownerId,
    deadline: inDays(10),
    priority: "medium",
  });
}

async function task(t: TestConvex, taskId: Id<"tasks">) {
  return (await t.run(async (ctx) => ctx.db.get("tasks", taskId)))!;
}

async function featureStatus(t: TestConvex, featureId: Id<"features">) {
  return (await t.run(async (ctx) => ctx.db.get("features", featureId)))!.status;
}

describe("peer review, submission and verification", () => {
  test("a code task: peer review, submit, verify; the feature moves on and goes live", async () => {
    const { t, coo, ceo, cto, featureId } = await setup();
    const taskId = await codeTask(coo.asUser, featureId, cto.userId, ceo.userId);
    expect(await featureStatus(t, featureId)).toBe("planned");

    // Submitting before a peer review is refused.
    await expectAppError(
      cto.asUser.mutation(api.reviews.submit, { taskId, note: "Done." }),
      "INVALID_ARGUMENT"
    );
    await cto.asUser.mutation(api.reviews.requestPeerReview, {
      taskId,
      note: "Look at the error paths.",
      proofUrl: "https://github.com/example/pull/1",
    });
    expect((await task(t, taskId)).status).toBe("in_peer_review");
    expect(await featureStatus(t, featureId)).toBe("in_progress");

    const reviewer = await ceo.asUser.query(api.reviews.forTask, { taskId });
    expect(reviewer.canDecidePeerReview).toBe(true);
    await ceo.asUser.mutation(api.reviews.decidePeerReview, { taskId, decision: "approved" });
    expect((await task(t, taskId)).status).toBe("in_progress");

    const owner = await cto.asUser.query(api.reviews.forTask, { taskId });
    expect(owner.canSubmit).toBe(true);
    await cto.asUser.mutation(api.reviews.submit, {
      taskId,
      note: "Both cases covered.",
      proofUrl: "https://example.com/build/42",
    });
    expect((await task(t, taskId)).status).toBe("submitted");
    expect((await task(t, taskId)).submittedAt).toBeDefined();

    // The owner (a member) can't verify; an admin can, once every criterion is ticked.
    await expectAppError(
      ceo.asUser.mutation(api.reviews.verify, {
        taskId,
        decision: "approved",
        criteriaMet: [true, true],
      }),
      "FORBIDDEN"
    );
    await expectAppError(
      coo.asUser.mutation(api.reviews.verify, {
        taskId,
        decision: "approved",
        criteriaMet: [true, false],
      }),
      "INVALID_ARGUMENT"
    );
    await coo.asUser.mutation(api.reviews.verify, {
      taskId,
      decision: "approved",
      criteriaMet: [true, true],
    });
    const verified = await task(t, taskId);
    expect(verified).toMatchObject({ status: "verified", progress: 100 });
    expect(verified.verifiedAt).toBeDefined();
    expect(await featureStatus(t, featureId)).toBe("internal_testing");

    await expectAppError(cto.asUser.mutation(api.features.markShipped, { featureId }), "FORBIDDEN");
    await coo.asUser.mutation(api.features.markShipped, { featureId });
    expect(await featureStatus(t, featureId)).toBe("shipped");

    const actions = await t.run(async (ctx) =>
      (await ctx.db.query("activity").collect()).map((a) => a.action)
    );
    for (const action of [
      "task.peer_review_requested",
      "task.peer_review_approved",
      "task.submitted",
      "task.verified",
      "feature.status_changed",
      "feature.shipped",
    ]) {
      expect(actions).toContain(action);
    }
  });

  test("changes from the verifier send a code task back through peer review", async () => {
    const { t, coo, ceo, cto, featureId } = await setup();
    const taskId = await codeTask(coo.asUser, featureId, cto.userId, ceo.userId);
    await cto.asUser.mutation(api.reviews.requestPeerReview, { taskId });
    await ceo.asUser.mutation(api.reviews.decidePeerReview, { taskId, decision: "approved" });
    await cto.asUser.mutation(api.reviews.submit, { taskId, note: "Ready." });
    // A reason is required to ask for changes.
    await expectAppError(
      coo.asUser.mutation(api.reviews.verify, {
        taskId,
        decision: "changes_requested",
        criteriaMet: [true, false],
      }),
      "INVALID_ARGUMENT"
    );
    await coo.asUser.mutation(api.reviews.verify, {
      taskId,
      decision: "changes_requested",
      criteriaMet: [true, false],
      note: "The right code is rejected too.",
    });
    expect((await task(t, taskId)).status).toBe("changes_requested");
    await expectAppError(
      cto.asUser.mutation(api.reviews.submit, { taskId, note: "Fixed." }),
      "INVALID_ARGUMENT"
    );
    expect((await cto.asUser.query(api.reviews.forTask, { taskId })).needsPeerReview).toBe(true);
    await cto.asUser.mutation(api.reviews.requestPeerReview, { taskId });
    await ceo.asUser.mutation(api.reviews.decidePeerReview, { taskId, decision: "approved" });
    await cto.asUser.mutation(api.reviews.submit, { taskId, note: "Fixed." });
    expect((await task(t, taskId)).status).toBe("submitted");
  });

  test("the peer reviewer can send it back with comments; only they decide", async () => {
    const { t, coo, ceo, cto, featureId } = await setup();
    const taskId = await codeTask(coo.asUser, featureId, cto.userId, ceo.userId);
    await cto.asUser.mutation(api.reviews.requestPeerReview, { taskId });
    await expectAppError(
      coo.asUser.mutation(api.reviews.decidePeerReview, { taskId, decision: "approved" }),
      "FORBIDDEN"
    );
    await expectAppError(
      cto.asUser.mutation(api.reviews.decidePeerReview, { taskId, decision: "approved" }),
      "FORBIDDEN"
    );
    await expectAppError(
      ceo.asUser.mutation(api.reviews.decidePeerReview, { taskId, decision: "changes_requested" }),
      "INVALID_ARGUMENT"
    );
    await ceo.asUser.mutation(api.reviews.decidePeerReview, {
      taskId,
      decision: "changes_requested",
      note: "Missing tests.",
    });
    expect((await task(t, taskId)).status).toBe("changes_requested");
    await expectAppError(
      cto.asUser.mutation(api.reviews.submit, { taskId, note: "Done." }),
      "INVALID_ARGUMENT"
    );
  });

  test("a non-code task is submitted directly; the note is required and the link checked", async () => {
    const { t, coo, cto, featureId } = await setup();
    const taskId = await contentTask(coo.asUser, featureId, cto.userId);
    await expectAppError(
      cto.asUser.mutation(api.reviews.requestPeerReview, { taskId }),
      "INVALID_ARGUMENT"
    );
    await expectAppError(
      cto.asUser.mutation(api.reviews.submit, { taskId, note: "  " }),
      "INVALID_ARGUMENT"
    );
    await expectAppError(
      cto.asUser.mutation(api.reviews.submit, {
        taskId,
        note: "Done.",
        proofUrl: "javascript:alert(1)",
      }),
      "INVALID_ARGUMENT"
    );
    await expectAppError(
      coo.asUser.mutation(api.reviews.submit, { taskId, note: "Not mine." }),
      "FORBIDDEN"
    );
    await cto.asUser.mutation(api.reviews.submit, { taskId, note: "All three screens." });
    expect((await task(t, taskId)).status).toBe("submitted");
    // Nothing else can be asked for while it waits.
    await expectAppError(
      cto.asUser.mutation(api.reviews.submit, { taskId, note: "Again." }),
      "INVALID_ARGUMENT"
    );
    await expectAppError(
      cto.asUser.mutation(api.tasks.postUpdate, { taskId, status: "in_progress", progress: 50 }),
      "INVALID_ARGUMENT"
    );
  });

  test("a blocked task can't be submitted; the owner can take a request back", async () => {
    const { t, coo, cto, featureId } = await setup();
    const taskId = await contentTask(coo.asUser, featureId, cto.userId);
    await cto.asUser.mutation(api.tasks.postUpdate, {
      taskId,
      status: "blocked",
      progress: 10,
      note: "Waiting on copy.",
    });
    await expectAppError(
      cto.asUser.mutation(api.reviews.submit, { taskId, note: "Done." }),
      "INVALID_ARGUMENT"
    );
    await cto.asUser.mutation(api.tasks.postUpdate, {
      taskId,
      status: "in_progress",
      progress: 90,
    });
    await cto.asUser.mutation(api.reviews.submit, { taskId, note: "Done." });
    // Only the owner can take it back.
    await expectAppError(coo.asUser.mutation(api.reviews.withdraw, { taskId }), "FORBIDDEN");
    await cto.asUser.mutation(api.reviews.withdraw, { taskId });
    expect((await task(t, taskId)).status).toBe("in_progress");
    // Taken back: the verifier can't decide it any more.
    await expectAppError(
      coo.asUser.mutation(api.reviews.verify, {
        taskId,
        decision: "approved",
        criteriaMet: [true],
      }),
      "INVALID_ARGUMENT"
    );
  });

  test("an admin's own task: the admin task reviewer verifies, not the admin or another admin", async () => {
    const { t, coo, cmo, ceo, featureId } = await setup();
    const taskId = await contentTask(coo.asUser, featureId, cmo.userId);
    await cmo.asUser.mutation(api.reviews.submit, { taskId, note: "Done." });
    await expectAppError(
      cmo.asUser.mutation(api.reviews.verify, {
        taskId,
        decision: "approved",
        criteriaMet: [true],
      }),
      "FORBIDDEN"
    );
    await expectAppError(
      coo.asUser.mutation(api.reviews.verify, {
        taskId,
        decision: "approved",
        criteriaMet: [true],
      }),
      "FORBIDDEN"
    );
    const forReviewer = await ceo.asUser.query(api.reviews.forTask, { taskId });
    expect(forReviewer.canVerify).toBe(true);
    expect(forReviewer.verifier).toEqual({ kind: "reviewer", name: "ceo", isOwner: false });
    await ceo.asUser.mutation(api.reviews.verify, {
      taskId,
      decision: "approved",
      criteriaMet: [true],
    });
    expect((await task(t, taskId)).status).toBe("verified");
  });

  test("waiting lists and the Board's count; a new task sends a feature back to In progress", async () => {
    const { t, coo, ceo, cto, featureId } = await setup();
    const code = await codeTask(coo.asUser, featureId, cto.userId, ceo.userId);
    const copy = await contentTask(coo.asUser, featureId, cto.userId);
    await cto.asUser.mutation(api.reviews.requestPeerReview, { taskId: code });
    await cto.asUser.mutation(api.reviews.submit, { taskId: copy, note: "Done." });

    const forCeo = await ceo.asUser.query(api.reviews.waiting, {});
    expect(forCeo.peerReviews.map((i) => i.task._id)).toEqual([code]);
    expect(forCeo.verifications).toEqual([]);
    const forCoo = await coo.asUser.query(api.reviews.waiting, {});
    expect(forCoo.verifications.map((i) => i.task._id)).toEqual([copy]);
    expect((await cto.asUser.query(api.tasks.waitingCount, {})).reviews).toBe(2);

    // Verify both; the feature reaches Internal testing, then a new task sends it back.
    await ceo.asUser.mutation(api.reviews.decidePeerReview, { taskId: code, decision: "approved" });
    await cto.asUser.mutation(api.reviews.submit, { taskId: code, note: "Done." });
    await coo.asUser.mutation(api.reviews.verify, {
      taskId: code,
      decision: "approved",
      criteriaMet: [true, true],
    });
    await coo.asUser.mutation(api.reviews.verify, {
      taskId: copy,
      decision: "approved",
      criteriaMet: [true],
    });
    expect(await featureStatus(t, featureId)).toBe("internal_testing");
    await contentTask(coo.asUser, featureId, cto.userId);
    expect(await featureStatus(t, featureId)).toBe("in_progress");
    await expectAppError(
      coo.asUser.mutation(api.features.markShipped, { featureId }),
      "INVALID_ARGUMENT"
    );
  });
});
