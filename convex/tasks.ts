import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { diffFields, logActivity } from "./lib/activity";
import { requireAdmin, requireUser } from "./lib/auth";
import { appError } from "./lib/errors";
import {
  cleanCriteria,
  cleanText,
  isLiveTask,
  LIMITS,
  requireFeature,
  requireTask,
  taskPlanArgs,
  validateTaskPlan,
} from "./lib/tasks";
import {
  isOwnerWorking,
  isPlanLocked,
  liveTaskStatusValidator,
  ownerStatusValidator,
  taskKindValidator,
  taskPriorityValidator,
} from "./lib/validators";
import {
  compareTasks,
  featureSummaryValidator,
  loadFeatureSummaries,
  loadUserDirectory,
  taskViewValidator,
  toFeatureSummary,
  toTaskView,
} from "./lib/views";
import schema from "./schema";

const isLive = isLiveTask;

/** Feature stages whose work belongs on the Board; shipped features drop off it. */
const ACTIVE_FEATURE_STATUSES = ["planned", "in_progress", "internal_testing"] as const;

/** Every feature that hasn't shipped, soonest deadline first. */
async function loadActiveFeatures(ctx: QueryCtx): Promise<Doc<"features">[]> {
  const lists = await Promise.all(
    ACTIVE_FEATURE_STATUSES.map((status) =>
      ctx.db
        .query("features")
        .withIndex("by_status_and_deadline", (q) => q.eq("status", status))
        .take(200)
    )
  );
  return lists.flat().sort((a, b) => a.deadline - b.deadline);
}

/**
 * The shared board: live tasks grouped by feature, soonest feature deadline first. By default
 * only features that haven't shipped (so verified work from shipped features doesn't pile up
 * and push newer tasks past the read limits); pick a feature to see it whatever its stage.
 * Tasks are read feature by feature, so each feature's list is complete.
 */
export const board = query({
  args: {
    ownerId: v.optional(v.id("users")),
    featureId: v.optional(v.id("features")),
    status: v.optional(liveTaskStatusValidator),
  },
  returns: v.array(
    v.object({ feature: featureSummaryValidator, tasks: v.array(taskViewValidator) })
  ),
  handler: async (ctx, { ownerId, featureId, status }) => {
    await requireUser(ctx);

    const features =
      featureId !== undefined
        ? [await ctx.db.get("features", featureId)].filter((f) => f !== null)
        : await loadActiveFeatures(ctx);

    const showEmptyFeatures = ownerId === undefined && status === undefined;
    const directory = await loadUserDirectory(ctx);
    const groups = [];
    for (const feature of features) {
      const tasks = (
        await ctx.db
          .query("tasks")
          .withIndex("by_featureId_and_status", (q) =>
            status === undefined
              ? q.eq("featureId", feature._id)
              : q.eq("featureId", feature._id).eq("status", status)
          )
          .take(500)
      ).filter((t) => isLive(t) && (ownerId === undefined || t.ownerId === ownerId));
      if (tasks.length === 0 && !showEmptyFeatures) continue;
      groups.push({
        feature: toFeatureSummary(feature),
        tasks: tasks.sort(compareTasks).map((t) => toTaskView(t, directory)),
      });
    }
    return groups;
  },
});

/** How many proposals are waiting for an admin (the Board's waiting tile). */
export const waitingCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireUser(ctx);
    const pending = await ctx.db
      .query("tasks")
      .withIndex("by_status_and_deadline", (q) => q.eq("status", "proposed"))
      .take(500);
    return pending.length;
  },
});

/**
 * One task and its feature. Takes the id as a plain string because it usually comes from a URL:
 * a malformed or wrong-table id returns null (the app shows "not found") instead of throwing.
 */
export const get = query({
  args: { taskId: v.string() },
  returns: v.union(
    v.null(),
    v.object({ task: taskViewValidator, feature: schema.doc("features") })
  ),
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const taskId = ctx.db.normalizeId("tasks", args.taskId);
    const task = taskId === null ? null : await ctx.db.get("tasks", taskId);
    if (task === null) return null;
    const feature = await requireFeature(ctx, task.featureId);
    const directory = await loadUserDirectory(ctx);
    return { task: toTaskView(task, directory), feature };
  },
});

/** The signed-in user's live tasks and the proposals they've made. */
export const mine = query({
  args: {},
  returns: v.object({
    owned: v.array(taskViewValidator),
    proposals: v.array(taskViewValidator),
    features: v.array(featureSummaryValidator),
  }),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const owned = (
      await ctx.db
        .query("tasks")
        .withIndex("by_ownerId_and_status", (q) => q.eq("ownerId", user._id))
        .take(500)
    ).filter(isLive);
    const proposals = await ctx.db
      .query("tasks")
      .withIndex("by_proposedBy_and_status", (q) => q.eq("proposedBy", user._id))
      .take(200);
    const pending = proposals.filter((t) => t.status === "proposed" || t.status === "declined");

    const directory = await loadUserDirectory(ctx);
    return {
      owned: owned.sort(compareTasks).map((t) => toTaskView(t, directory)),
      proposals: pending
        .sort((a, b) => b._creationTime - a._creationTime)
        .map((t) => toTaskView(t, directory)),
      features: await loadFeatureSummaries(ctx, [...owned, ...pending]),
    };
  },
});

/** Proposals waiting for the admin, oldest first. Visible to everyone. */
export const proposals = query({
  args: {},
  returns: v.object({
    proposals: v.array(taskViewValidator),
    features: v.array(featureSummaryValidator),
  }),
  handler: async (ctx) => {
    await requireUser(ctx);
    const pending = await ctx.db
      .query("tasks")
      .withIndex("by_status_and_deadline", (q) => q.eq("status", "proposed"))
      .take(200);
    const directory = await loadUserDirectory(ctx);
    return {
      proposals: pending
        .sort((a, b) => a._creationTime - b._creationTime)
        .map((t) => toTaskView(t, directory)),
      features: await loadFeatureSummaries(ctx, pending),
    };
  },
});

/** Admin: create a live task (status "to do"). */
export const create = mutation({
  args: { featureId: v.id("features"), ...taskPlanArgs },
  returns: v.id("tasks"),
  handler: async (ctx, { featureId, ...input }) => {
    const admin = await requireAdmin(ctx);
    const feature = await requireFeature(ctx, featureId);
    const plan = await validateTaskPlan(ctx, feature, input, Date.now());

    const taskId = await ctx.db.insert("tasks", {
      featureId,
      ...plan,
      originalDeadline: plan.deadline,
      status: "todo",
      progress: 0,
      countsAsLate: false,
    });
    await logActivity(ctx, {
      actorId: admin._id,
      entityType: "task",
      entityId: taskId,
      taskId,
      action: "task.created",
      after: { featureId, ...plan },
    });
    return taskId;
  },
});

/** Admin: edit a live task's plan (title, criteria, owner, reviewer, deadline, priority...). */
export const update = mutation({
  args: { taskId: v.id("tasks"), ...taskPlanArgs },
  returns: v.null(),
  handler: async (ctx, { taskId, ...input }) => {
    const admin = await requireAdmin(ctx);
    const task = await requireTask(ctx, taskId);
    if (!isLive(task)) {
      throw appError("INVALID_ARGUMENT", "Proposals are approved or declined, not edited.");
    }
    if (isPlanLocked(task.status)) {
      throw appError(
        "INVALID_ARGUMENT",
        "This task is in review, submitted or verified, so its plan is locked. It can change again once it's sent back to its owner."
      );
    }
    const feature = await requireFeature(ctx, task.featureId);
    const plan = await validateTaskPlan(ctx, feature, input, Date.now(), task.deadline);
    // Nobody moves their own deadline: that's what extension requests (extensions.ts) are for.
    if (task.ownerId === admin._id && plan.deadline !== task.deadline) {
      throw appError(
        "FORBIDDEN",
        "You can't move the deadline of a task you own. Another admin can, or request an extension."
      );
    }

    const changes = diffFields(task, plan);
    if (changes === null) return null;
    // Moved to a date still ahead: no longer overdue.
    const clearOverdue = task.overdueSince !== undefined && plan.deadline > Date.now();
    await ctx.db.patch("tasks", taskId, clearOverdue ? { ...plan, overdueSince: undefined } : plan);
    await logActivity(ctx, {
      actorId: admin._id,
      entityType: "task",
      entityId: taskId,
      taskId,
      action: "task.updated",
      ...changes,
    });
    return null;
  },
});

/**
 * Owner: post an update on their task: its status (to do, in progress, blocked), its progress
 * (0–100) and an optional note, which is required when marking it blocked (say what's in the
 * way). Not while it's with its reviewer or verified: it's theirs again once sent back.
 */
export const postUpdate = mutation({
  args: {
    taskId: v.id("tasks"),
    status: ownerStatusValidator,
    progress: v.number(),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { taskId, status, progress, note }) => {
    const user = await requireUser(ctx);
    const task = await requireTask(ctx, taskId);
    if (!isLive(task)) {
      throw appError("INVALID_ARGUMENT", "Only live tasks take updates.");
    }
    if (task.ownerId !== user._id) {
      throw appError("FORBIDDEN", "Only the task's owner can post updates on it.");
    }
    if (!isOwnerWorking(task.status)) {
      throw appError(
        "INVALID_ARGUMENT",
        "This task is with its reviewer or already verified. You can update it again if it's sent back to you."
      );
    }
    if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
      throw appError("INVALID_ARGUMENT", "Progress must be a whole number from 0 to 100.");
    }
    const text = cleanText(note ?? "", "Note", { required: false, max: LIMITS.note });
    if (status === "blocked" && task.status !== "blocked" && text === "") {
      throw appError("INVALID_ARGUMENT", "Say what's blocking it, so the team can help.");
    }

    const changed = status !== task.status || progress !== task.progress;
    if (!changed && text === "") return null;
    if (changed) await ctx.db.patch("tasks", taskId, { status, progress });
    await logActivity(ctx, {
      actorId: user._id,
      entityType: "task",
      entityId: taskId,
      taskId,
      action: "task.update_posted",
      before: { status: task.status, progress: task.progress },
      after: { status, progress, ...(text !== "" ? { note: text } : {}) },
    });
    return null;
  },
});

/** Anyone: propose a task for a feature. It goes live only once an admin approves it. */
export const propose = mutation({
  args: {
    featureId: v.id("features"),
    title: v.string(),
    description: v.string(),
    kind: taskKindValidator,
    acceptanceCriteria: v.array(v.string()), // suggestions; the admin finalises them
    priority: taskPriorityValidator,
  },
  returns: v.id("tasks"),
  handler: async (ctx, { featureId, ...input }) => {
    const user = await requireUser(ctx);
    const feature = await requireFeature(ctx, featureId);
    if (feature.status === "shipped") {
      throw appError("INVALID_ARGUMENT", "This feature has shipped; it can't take new work.");
    }
    const fields = {
      title: cleanText(input.title, "Title", { required: true, max: LIMITS.title }),
      description: cleanText(input.description, "Description", {
        required: true,
        max: LIMITS.description,
      }),
      kind: input.kind,
      acceptanceCriteria: cleanCriteria(input.acceptanceCriteria, { required: false }),
      priority: input.priority,
    };

    const taskId = await ctx.db.insert("tasks", {
      featureId,
      ...fields,
      proposedBy: user._id,
      status: "proposed",
      progress: 0,
      countsAsLate: false,
    });
    await logActivity(ctx, {
      actorId: user._id,
      entityType: "task",
      entityId: taskId,
      taskId,
      action: "task.proposed",
      after: { featureId, ...fields },
    });
    return taskId;
  },
});

/** Admin: approve a proposal, completing its plan. It becomes a live "to do" task. */
export const approveProposal = mutation({
  args: { taskId: v.id("tasks"), ...taskPlanArgs },
  returns: v.null(),
  handler: async (ctx, { taskId, ...input }) => {
    const admin = await requireAdmin(ctx);
    const task = await requireTask(ctx, taskId);
    if (task.status !== "proposed") {
      throw appError("INVALID_ARGUMENT", "This task isn't waiting for approval.");
    }
    const feature = await requireFeature(ctx, task.featureId);
    const plan = await validateTaskPlan(ctx, feature, input, Date.now());

    await ctx.db.patch("tasks", taskId, {
      ...plan,
      originalDeadline: plan.deadline,
      status: "todo",
    });
    await logActivity(ctx, {
      actorId: admin._id,
      entityType: "task",
      entityId: taskId,
      taskId,
      action: "task.proposal_approved",
      before: { status: task.status },
      after: { status: "todo", ...plan },
    });
    return null;
  },
});

/** Admin: decline a proposal with a reason the proposer can read. */
export const declineProposal = mutation({
  args: { taskId: v.id("tasks"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, { taskId, reason }) => {
    const admin = await requireAdmin(ctx);
    const task = await requireTask(ctx, taskId);
    if (task.status !== "proposed") {
      throw appError("INVALID_ARGUMENT", "This task isn't waiting for approval.");
    }
    const declineReason = cleanText(reason, "Reason", { required: true, max: LIMITS.reason });

    await ctx.db.patch("tasks", taskId, { status: "declined", declineReason });
    await logActivity(ctx, {
      actorId: admin._id,
      entityType: "task",
      entityId: taskId,
      taskId,
      action: "task.proposal_declined",
      before: { status: task.status },
      after: { status: "declined", declineReason },
    });
    return null;
  },
});
