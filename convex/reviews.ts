import { v, type Infer } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { logActivity } from "./lib/activity";
import { requireUser } from "./lib/auth";
import { appError } from "./lib/errors";
import { deciderValidator, loadDeciders } from "./lib/extensions";
import {
  cleanProofUrl,
  hasCurrentPeerApproval,
  isPending,
  isReady,
  loadReviews,
  rollUpFeature,
} from "./lib/reviews";
import { REVIEW_LIMITS } from "./lib/constants";
import { cleanText, isLiveTask, requireFeature, requireTask } from "./lib/tasks";
import { verificationDecisionValidator } from "./lib/validators";
import {
  featureSummaryValidator,
  loadUserDirectory,
  taskViewValidator,
  toFeatureSummary,
  toTaskView,
  userSummaryValidator,
  type UserDirectory,
} from "./lib/views";
import schema from "./schema";

/**
 * Peer review and verification (Phase 6). A code task goes to its peer reviewer first, who
 * approves it or sends it back with comments; the owner then submits it (any task) with a note and
 * a link as proof, and a verifier (an admin; for an admin's own task the admin task reviewer, or
 * the other admins when the reviewer can't) checks each acceptance criterion and verifies it or
 * asks for changes with a reason. Changes send a code task back through peer review. The owner can
 * take a pending request back. Nobody reviews or verifies their own work. Every step is an activity
 * entry tagged with the task, and each one moves the feature's stage on if it should.
 */

const reviewViewValidator = schema.doc("verifications").extend({
  submitter: v.union(userSummaryValidator, v.null()),
  reviewer: v.union(userSummaryValidator, v.null()),
});
export type ReviewView = Infer<typeof reviewViewValidator>;

function toReviewView(row: Doc<"verifications">, directory: UserDirectory): ReviewView {
  return {
    ...row,
    submitter: directory.get(row.submittedBy) ?? null,
    reviewer: row.reviewerId !== undefined ? (directory.get(row.reviewerId) ?? null) : null,
  };
}

/** The task, checked live and in its owner's hands, for the owner's own steps. */
async function requireOwnersLiveTask(
  ctx: QueryCtx,
  taskId: Id<"tasks">,
  userId: Id<"users">
): Promise<Doc<"tasks">> {
  const task = await requireTask(ctx, taskId);
  if (!isLiveTask(task)) throw appError("INVALID_ARGUMENT", "Only live tasks are reviewed.");
  if (task.ownerId !== userId) {
    throw appError("FORBIDDEN", "Only the task's owner can do this.");
  }
  return task;
}

async function requireOpenFeature(ctx: QueryCtx, task: Doc<"tasks">): Promise<void> {
  const feature = await requireFeature(ctx, task.featureId);
  if (feature.status === "shipped") {
    throw appError("INVALID_ARGUMENT", "This feature has shipped; its tasks are closed.");
  }
}

function cleanNote(value: string | undefined, label: string, required: boolean): string {
  return cleanText(value ?? "", label, { required, max: REVIEW_LIMITS.note });
}

async function setStatus(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  patch: Partial<Doc<"tasks">> & { status: Doc<"tasks">["status"] }
): Promise<void> {
  await ctx.db.patch("tasks", task._id, patch);
}

/** Owner of a code task: ask its peer reviewer to review it (note and link optional). */
export const requestPeerReview = mutation({
  args: { taskId: v.id("tasks"), note: v.optional(v.string()), proofUrl: v.optional(v.string()) },
  returns: v.id("verifications"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const task = await requireOwnersLiveTask(ctx, args.taskId, user._id);
    if (task.kind !== "code" || task.peerReviewerId === undefined) {
      throw appError("INVALID_ARGUMENT", "Only code tasks go to a peer reviewer.");
    }
    if (!isReady(task.status)) {
      throw appError(
        "INVALID_ARGUMENT",
        task.status === "blocked"
          ? "Unblock the task before asking for a review."
          : "This task is already with its reviewer, or verified."
      );
    }
    await requireOpenFeature(ctx, task);
    const reviewer = await ctx.db.get("users", task.peerReviewerId);
    if (reviewer === null || !reviewer.isActive) {
      throw appError(
        "INVALID_ARGUMENT",
        "The peer reviewer has been deactivated. Ask an admin to choose another."
      );
    }
    const rows = await loadReviews(ctx, task._id);
    if (rows.some(isPending)) throw appError("INVALID_ARGUMENT", "A review is already waiting.");
    const note = cleanNote(args.note, "Note", false);
    const proofUrl = cleanProofUrl(args.proofUrl);

    const reviewId = await ctx.db.insert("verifications", {
      taskId: task._id,
      stage: "peer_review",
      submittedBy: user._id,
      note,
      proofUrl,
    });
    await setStatus(ctx, task, { status: "in_peer_review" });
    await logActivity(ctx, {
      actorId: user._id,
      entityType: "verification",
      entityId: reviewId,
      taskId: task._id,
      action: "task.peer_review_requested",
      before: { status: task.status },
      after: { status: "in_peer_review", ...(note !== "" ? { note } : {}), proofUrl },
    });
    await rollUpFeature(ctx, task.featureId);
    return reviewId;
  },
});

/**
 * The task's peer reviewer: approve the code (it goes back to the owner, who can then submit it)
 * or send it back with comments (required).
 */
export const decidePeerReview = mutation({
  args: {
    taskId: v.id("tasks"),
    decision: verificationDecisionValidator,
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const task = await requireTask(ctx, args.taskId);
    const pending = (await loadReviews(ctx, task._id)).find(
      (row) => row.stage === "peer_review" && isPending(row)
    );
    if (pending === undefined || task.status !== "in_peer_review") {
      throw appError("INVALID_ARGUMENT", "There's no peer review waiting on this task.");
    }
    if (task.peerReviewerId !== user._id || task.ownerId === user._id) {
      throw appError("FORBIDDEN", "Only the task's peer reviewer can decide this.");
    }
    const changes = args.decision === "changes_requested";
    const note = cleanNote(args.note, changes ? "What needs changing" : "Note", changes);

    await ctx.db.patch("verifications", pending._id, {
      decision: args.decision,
      reviewerId: user._id,
      reason: note === "" ? undefined : note,
      decidedAt: Date.now(),
    });
    const status = changes ? "changes_requested" : "in_progress";
    await setStatus(ctx, task, { status });
    await logActivity(ctx, {
      actorId: user._id,
      entityType: "verification",
      entityId: pending._id,
      taskId: task._id,
      action: changes ? "task.peer_review_changes_requested" : "task.peer_review_approved",
      before: { status: task.status },
      after: { status, ...(note !== "" ? { note } : {}) },
    });
    await rollUpFeature(ctx, task.featureId);
    return null;
  },
});

/**
 * Owner: submit the task for verification with a note (required) and a link as proof (optional).
 * A code task needs a peer review approved since changes were last asked for.
 */
export const submit = mutation({
  args: { taskId: v.id("tasks"), note: v.string(), proofUrl: v.optional(v.string()) },
  returns: v.id("verifications"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const task = await requireOwnersLiveTask(ctx, args.taskId, user._id);
    if (!isReady(task.status)) {
      throw appError(
        "INVALID_ARGUMENT",
        task.status === "blocked"
          ? "Unblock the task before submitting it."
          : "This task is already with its reviewer, or verified."
      );
    }
    await requireOpenFeature(ctx, task);
    const rows = await loadReviews(ctx, task._id);
    if (rows.some(isPending)) throw appError("INVALID_ARGUMENT", "A review is already waiting.");
    if (task.kind === "code" && !hasCurrentPeerApproval(rows)) {
      throw appError(
        "INVALID_ARGUMENT",
        "A code task needs its peer reviewer's approval before it's submitted."
      );
    }
    if (!(await (await loadDeciders(ctx)).hasDecider(task))) {
      throw appError(
        "INVALID_ARGUMENT",
        "Nobody can verify this task yet: set the admin task reviewer in Team rules, or add another admin."
      );
    }
    const note = cleanNote(args.note, "Note", true);
    const proofUrl = cleanProofUrl(args.proofUrl);

    const reviewId = await ctx.db.insert("verifications", {
      taskId: task._id,
      stage: "verification",
      submittedBy: user._id,
      note,
      proofUrl,
    });
    await setStatus(ctx, task, { status: "submitted", submittedAt: Date.now() });
    await logActivity(ctx, {
      actorId: user._id,
      entityType: "verification",
      entityId: reviewId,
      taskId: task._id,
      action: "task.submitted",
      before: { status: task.status },
      after: { status: "submitted", note, proofUrl },
    });
    await rollUpFeature(ctx, task.featureId);
    return reviewId;
  },
});

/**
 * A verifier: check each acceptance criterion (`criteriaMet`, in the task's order) and verify the
 * task (every one ticked) or ask for changes with a reason. Verifying sets progress to 100%.
 */
export const verify = mutation({
  args: {
    taskId: v.id("tasks"),
    decision: verificationDecisionValidator,
    criteriaMet: v.array(v.boolean()),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const task = await requireTask(ctx, args.taskId);
    const pending = (await loadReviews(ctx, task._id)).find(
      (row) => row.stage === "verification" && isPending(row)
    );
    if (pending === undefined || task.status !== "submitted") {
      throw appError("INVALID_ARGUMENT", "This task isn't waiting to be verified.");
    }
    if (!(await (await loadDeciders(ctx)).canDecide(user, task))) {
      throw appError(
        "FORBIDDEN",
        "Only an admin verifies this (for an admin's own task, the admin task reviewer), and never their own work."
      );
    }
    if (args.criteriaMet.length !== task.acceptanceCriteria.length) {
      throw appError("INVALID_ARGUMENT", "Check each acceptance criterion.");
    }
    const changes = args.decision === "changes_requested";
    if (!changes && args.criteriaMet.some((met) => !met)) {
      throw appError(
        "INVALID_ARGUMENT",
        "Every acceptance criterion has to be met to verify it. Otherwise, ask for changes."
      );
    }
    const note = cleanNote(args.note, changes ? "What needs changing" : "Note", changes);
    const now = Date.now();

    await ctx.db.patch("verifications", pending._id, {
      decision: args.decision,
      reviewerId: user._id,
      reason: note === "" ? undefined : note,
      decidedAt: now,
      criteriaMet: args.criteriaMet,
    });
    if (changes) await setStatus(ctx, task, { status: "changes_requested" });
    else await setStatus(ctx, task, { status: "verified", verifiedAt: now, progress: 100 });
    await logActivity(ctx, {
      actorId: user._id,
      entityType: "verification",
      entityId: pending._id,
      taskId: task._id,
      action: changes ? "task.changes_requested" : "task.verified",
      before: { status: task.status },
      after: {
        status: changes ? "changes_requested" : "verified",
        criteriaMet: args.criteriaMet,
        ...(note !== "" ? { note } : {}),
      },
    });
    await rollUpFeature(ctx, task.featureId);
    return null;
  },
});

/** Owner: take a pending peer review or submission back (the task returns to In progress). */
export const withdraw = mutation({
  args: { taskId: v.id("tasks") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const task = await requireOwnersLiveTask(ctx, args.taskId, user._id);
    const pending = (await loadReviews(ctx, task._id)).find(isPending);
    if (pending === undefined)
      throw appError("INVALID_ARGUMENT", "Nothing is waiting to take back.");
    await ctx.db.patch("verifications", pending._id, { withdrawnAt: Date.now() });
    await setStatus(ctx, task, { status: "in_progress" });
    await logActivity(ctx, {
      actorId: user._id,
      entityType: "verification",
      entityId: pending._id,
      taskId: task._id,
      action: "task.review_withdrawn",
      before: { status: task.status },
      after: { status: "in_progress", stage: pending.stage },
    });
    await rollUpFeature(ctx, task.featureId);
    return null;
  },
});

/**
 * A task's reviews for its page: every request and decision (newest first), the one waiting (if
 * any), and what the signed-in user can do now (mirroring the rules above).
 */
export const forTask = query({
  args: { taskId: v.id("tasks") },
  returns: v.object({
    history: v.array(reviewViewValidator),
    pending: v.union(reviewViewValidator, v.null()),
    /** A code task without a peer approval since changes were last asked for. */
    needsPeerReview: v.boolean(),
    canAskPeerReview: v.boolean(),
    canSubmit: v.boolean(),
    canDecidePeerReview: v.boolean(),
    canVerify: v.boolean(),
    canWithdraw: v.boolean(),
    /** Who verifies this task, for the app to name; `hasVerifier` false when nobody could. */
    verifier: deciderValidator,
    hasVerifier: v.boolean(),
  }),
  handler: async (ctx, { taskId }) => {
    const user = await requireUser(ctx);
    const task = await requireTask(ctx, taskId);
    const feature = await requireFeature(ctx, task.featureId);
    const rows = await loadReviews(ctx, taskId);
    const directory = await loadUserDirectory(ctx);
    const deciders = await loadDeciders(ctx);
    const pendingRow = rows.find(isPending) ?? null;
    const isOwner = task.ownerId === user._id;
    const open = isLiveTask(task) && feature.status !== "shipped";
    const isCode = task.kind === "code" && task.peerReviewerId !== undefined;
    const needsPeerReview = isCode && !hasCurrentPeerApproval(rows);
    const ownerCanAct = open && isOwner && pendingRow === null && isReady(task.status);
    const hasVerifier = await deciders.hasDecider(task);
    return {
      history: [...rows].reverse().map((row) => toReviewView(row, directory)),
      pending: pendingRow === null ? null : toReviewView(pendingRow, directory),
      needsPeerReview,
      canAskPeerReview: ownerCanAct && isCode,
      canSubmit: ownerCanAct && !needsPeerReview && hasVerifier,
      canDecidePeerReview:
        pendingRow?.stage === "peer_review" &&
        task.status === "in_peer_review" &&
        task.peerReviewerId === user._id &&
        !isOwner,
      canVerify:
        pendingRow?.stage === "verification" &&
        task.status === "submitted" &&
        (await deciders.canDecide(user, task)),
      canWithdraw: isOwner && pendingRow !== null,
      verifier: await deciders.deciderOf(task),
      hasVerifier,
    };
  },
});

const waitingItemValidator = v.object({
  review: reviewViewValidator,
  task: taskViewValidator,
  feature: v.union(featureSummaryValidator, v.null()),
});

/**
 * What's waiting on the signed-in user: peer reviews of tasks they review, and submissions they
 * can verify (My Tasks, the Admin tab). Oldest first.
 */
export const waiting = query({
  args: {},
  returns: v.object({
    peerReviews: v.array(waitingItemValidator),
    verifications: v.array(waitingItemValidator),
  }),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const deciders = await loadDeciders(ctx);
    const directory = await loadUserDirectory(ctx);
    const pendingOf = async (stage: "peer_review" | "verification") =>
      (
        await ctx.db
          .query("verifications")
          .withIndex("by_stage_and_decision", (q) => q.eq("stage", stage).eq("decision", undefined))
          .take(200)
      ).filter((row) => row.withdrawnAt === undefined);

    const item = async (row: Doc<"verifications">, task: Doc<"tasks">) => {
      const feature = await ctx.db.get("features", task.featureId);
      return {
        review: toReviewView(row, directory),
        task: toTaskView(task, directory),
        feature: feature === null ? null : toFeatureSummary(feature),
      };
    };
    const peerReviews = [];
    for (const row of await pendingOf("peer_review")) {
      const task = await ctx.db.get("tasks", row.taskId);
      if (task !== null && task.status === "in_peer_review" && task.peerReviewerId === user._id) {
        peerReviews.push(await item(row, task));
      }
    }
    const verifications = [];
    for (const row of await pendingOf("verification")) {
      const task = await ctx.db.get("tasks", row.taskId);
      if (task !== null && task.status === "submitted" && (await deciders.canDecide(user, task))) {
        verifications.push(await item(row, task));
      }
    }
    return { peerReviews, verifications };
  },
});
