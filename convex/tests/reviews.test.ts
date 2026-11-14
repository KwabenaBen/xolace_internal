import { afterEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { toDateOnly } from "../lib/dates";
import { cleanProofUrl } from "../lib/reviews";
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
    // Progress stays where submitting put it; the owner lowers it with an update if they want.
    expect((await task(t, taskId)).progress).toBe(100);
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
    // Submitting from 0%: it says "done", so progress goes to 100% (and the log says so).
    expect((await task(t, taskId)).progress).toBe(0);
    await cto.asUser.mutation(api.reviews.submit, { taskId, note: "All three screens." });
    expect((await task(t, taskId)).status).toBe("submitted");
    expect((await task(t, taskId)).progress).toBe(100);
    const entry = await t.run(async (ctx) =>
      (await ctx.db.query("activity").collect()).find((a) => a.action === "task.submitted")
    );
    expect(entry?.before).toMatchObject({ progress: 0 });
    expect(entry?.after).toMatchObject({ progress: 100 });
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

  test("a peer approval counts only from the current reviewer, for the current owner", async () => {
    const { coo, ceo, cto, featureId } = await setup();
    const taskId = await codeTask(coo.asUser, featureId, cto.userId, ceo.userId);
    await cto.asUser.mutation(api.reviews.requestPeerReview, { taskId });
    await ceo.asUser.mutation(api.reviews.decidePeerReview, { taskId, decision: "approved" });
    // The admin swaps them round: the old reviewer can't submit on their own approval.
    await coo.asUser.mutation(api.tasks.update, {
      taskId,
      title: "Sign-up API",
      description: "",
      kind: "code",
      acceptanceCriteria: ["Rejects a wrong code", "Accepts the right one"],
      ownerId: ceo.userId,
      peerReviewerId: cto.userId,
      deadline: inDays(10),
      priority: "high",
    });
    const forCeo = await ceo.asUser.query(api.reviews.forTask, { taskId });
    expect(forCeo.needsPeerReview).toBe(true);
    expect(forCeo.canSubmit).toBe(false);
    await expectAppError(
      ceo.asUser.mutation(api.reviews.submit, { taskId, note: "Done." }),
      "INVALID_ARGUMENT"
    );
  });

  test("a deactivated peer reviewer: no asking, and the owner takes a waiting review back", async () => {
    const { t, coo, ceo, cto, featureId } = await setup();
    const taskId = await codeTask(coo.asUser, featureId, cto.userId, ceo.userId);
    await cto.asUser.mutation(api.reviews.requestPeerReview, { taskId });
    await coo.asUser.mutation(api.users.setActive, { userId: ceo.userId, isActive: false });
    expect((await cto.asUser.query(api.reviews.forTask, { taskId })).canWithdraw).toBe(true);
    await cto.asUser.mutation(api.reviews.withdraw, { taskId });
    expect((await task(t, taskId)).status).toBe("in_progress");
    // Taken back, it's no approval; asking again waits for an admin to pick another reviewer.
    const after = await cto.asUser.query(api.reviews.forTask, { taskId });
    expect(after.needsPeerReview).toBe(true);
    expect(after.canAskPeerReview).toBe(false);
    await expectAppError(
      cto.asUser.mutation(api.reviews.requestPeerReview, { taskId }),
      "INVALID_ARGUMENT"
    );
  });

  test("taken-back requests leave the waiting lists; a task can't ask for ever", async () => {
    const { coo, cto, featureId } = await setup();
    const taskId = await contentTask(coo.asUser, featureId, cto.userId);
    for (let i = 0; i < 50; i++) {
      await cto.asUser.mutation(api.reviews.submit, { taskId, note: `Try ${i}.` });
      await cto.asUser.mutation(api.reviews.withdraw, { taskId });
    }
    expect((await coo.asUser.query(api.reviews.waiting, {})).verifications).toEqual([]);
    expect((await cto.asUser.query(api.reviews.forTask, { taskId })).canSubmit).toBe(false);
    const refused = await expectAppError(
      cto.asUser.mutation(api.reviews.submit, { taskId, note: "Once more." }),
      "INVALID_ARGUMENT"
    );
    expect(refused?.message).toContain("50 reviews");
    // A real submission elsewhere still shows.
    const other = await contentTask(coo.asUser, featureId, cto.userId);
    await cto.asUser.mutation(api.reviews.submit, { taskId: other, note: "Done." });
    const waiting = await coo.asUser.query(api.reviews.waiting, {});
    expect(waiting.verifications.map((item) => item.task._id)).toEqual([other]);
  });

  test("the criteria ticked are kept with the decision; verifying closes a request for more time", async () => {
    const { t, coo, cto, featureId } = await setup();
    const taskId = await contentTask(coo.asUser, featureId, cto.userId);
    await cto.asUser.mutation(api.extensions.request, {
      taskId,
      newDeadline: inDays(20),
      type: "scope_change",
      reason: "The copy grew.",
    });
    await cto.asUser.mutation(api.reviews.submit, { taskId, note: "Done." });
    await coo.asUser.mutation(api.reviews.verify, {
      taskId,
      decision: "changes_requested",
      criteriaMet: [false],
      note: "Only two screens.",
    });
    // The plan can change once it's sent back; the decision keeps what was ticked against.
    await coo.asUser.mutation(api.tasks.update, {
      taskId,
      title: "Welcome copy",
      description: "",
      kind: "content",
      acceptanceCriteria: ["Reviewed by the CEO", "Three screens"],
      ownerId: cto.userId,
      deadline: inDays(10),
      priority: "medium",
    });
    const decided = (await cto.asUser.query(api.reviews.forTask, { taskId })).history[0];
    expect(decided.criteria).toEqual(["Three screens"]);
    expect(decided.criteriaMet).toEqual([false]);

    await cto.asUser.mutation(api.reviews.submit, { taskId, note: "All three now." });
    await coo.asUser.mutation(api.reviews.verify, {
      taskId,
      decision: "approved",
      criteriaMet: [true, true],
    });
    const requests = await t.run(async (ctx) => ctx.db.query("extensionRequests").collect());
    expect(requests.map((r) => r.status)).toEqual(["withdrawn"]);
    expect(await coo.asUser.query(api.extensions.pending, {})).toEqual([]);
  });

  test("Mark as live waits for proposals; stage changes name the task; old stages catch up", async () => {
    const { t, coo, ceo, cto, featureId } = await setup();
    const taskId = await contentTask(coo.asUser, featureId, cto.userId);
    await cto.asUser.mutation(api.reviews.submit, { taskId, note: "Done." });
    await coo.asUser.mutation(api.reviews.verify, {
      taskId,
      decision: "approved",
      criteriaMet: [true],
    });
    expect(await featureStatus(t, featureId)).toBe("internal_testing");
    const moves = await t.run(async (ctx) =>
      (await ctx.db.query("activity").collect()).filter(
        (a) => a.action === "feature.status_changed"
      )
    );
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((a) => a.taskId === taskId)).toBe(true);

    const proposal = await ceo.asUser.mutation(api.tasks.propose, {
      featureId,
      title: "One more screen",
      description: "A fourth welcome screen.",
      kind: "content",
      acceptanceCriteria: ["A fourth screen"],
      priority: "low",
    });
    const refused = await expectAppError(
      coo.asUser.mutation(api.features.markShipped, { featureId }),
      "INVALID_ARGUMENT"
    );
    expect(refused?.message).toContain("proposal");
    await coo.asUser.mutation(api.tasks.declineProposal, { taskId: proposal, reason: "Later." });
    await coo.asUser.mutation(api.features.markShipped, { featureId });
    expect(await featureStatus(t, featureId)).toBe("shipped");

    // A feature left behind from before stages rolled up catches up (CLI, once per deployment).
    const other = await coo.asUser.mutation(api.features.create, {
      title: "Payments",
      description: "x",
      expectedResult: "x",
      sourceNote: "",
      deadline: inDays(30),
    });
    const started = await contentTask(coo.asUser, other, cto.userId);
    await cto.asUser.mutation(api.tasks.postUpdate, {
      taskId: started,
      status: "in_progress",
      progress: 10,
    });
    await t.run(async (ctx) => ctx.db.patch("features", other, { status: "planned" }));
    expect(await t.mutation(internal.features.rollUpStages, {})).toContain("moved 1");
    expect(await featureStatus(t, other)).toBe("in_progress");
    expect(await featureStatus(t, featureId)).toBe("shipped");
  });
});

describe("proof links", () => {
  test("only plain http(s) links, stored in their standard form", () => {
    expect(cleanProofUrl("  https://Example.com/pull/1 ")).toBe("https://example.com/pull/1");
    expect(cleanProofUrl("http://example.com")).toBe("http://example.com/");
    expect(cleanProofUrl("")).toBeUndefined();
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,hi",
      "file:///etc/passwd",
      "example.com/pull/1",
      "https://github.com@evil.example/x",
      "https://user:pass@example.com",
      "https://example.com/a b",
      "https://example.com/‮gnp.exe",
      "https://exa​mple.com",
      `https://example.com/${"a".repeat(500)}`,
    ]) {
      expect(() => cleanProofUrl(bad), bad).toThrow();
    }
    // A look-alike host is stored as punycode, so it shows for what it is.
    expect(cleanProofUrl("https://gіthub.com/x")).toMatch(/^https:\/\/xn--/);
  });
});
