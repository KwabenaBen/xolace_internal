import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { diffFields, logActivity } from "./lib/activity";
import { requireAdmin, requireUser } from "./lib/auth";
import { appError } from "./lib/errors";
import {
  cleanCriteria,
  cleanText,
  LIMITS,
  requireFeature,
  requireTask,
  taskPlanArgs,
  validateTaskPlan,
} from "./lib/tasks";
import {
  LIVE_TASK_STATUSES,
  liveTaskStatusValidator,
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

function isLive(task: Doc<"tasks">): boolean {
  return task.status !== "proposed" && task.status !== "declined";
}

/**
 * The shared board: live tasks grouped by feature (soonest feature deadline first), with
 * optional filters. Without an owner or status filter, features with no tasks are included,
 * so a freshly planned feature still shows up.
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

    // Narrow with the most selective index, then apply the remaining filters in memory.
    let tasks: Doc<"tasks">[];
    if (ownerId !== undefined) {
      tasks = await ctx.db
        .query("tasks")
        .withIndex("by_ownerId_and_status", (q) =>
          status === undefined
            ? q.eq("ownerId", ownerId)
            : q.eq("ownerId", ownerId).eq("status", status)
        )
        .take(500);
    } else if (featureId !== undefined) {
      tasks = await ctx.db
        .query("tasks")
        .withIndex("by_featureId_and_status", (q) =>
          status === undefined
            ? q.eq("featureId", featureId)
            : q.eq("featureId", featureId).eq("status", status)
        )
        .take(500);
    } else {
      const statuses = status === undefined ? LIVE_TASK_STATUSES : [status];
      tasks = [];
      for (const s of statuses) {
        tasks.push(
          ...(await ctx.db
            .query("tasks")
            .withIndex("by_status_and_deadline", (q) => q.eq("status", s))
            .take(500))
        );
      }
    }
    tasks = tasks.filter(
      (t) =>
        isLive(t) &&
        (featureId === undefined || t.featureId === featureId) &&
        (status === undefined || t.status === status)
    );

    const byFeature = new Map<Id<"features">, Doc<"tasks">[]>();
    for (const task of tasks) {
      byFeature.set(task.featureId, [...(byFeature.get(task.featureId) ?? []), task]);
    }

    const showEmptyFeatures = ownerId === undefined && status === undefined;
    const features =
      featureId !== undefined
        ? [await ctx.db.get("features", featureId)].filter((f) => f !== null)
        : await ctx.db.query("features").withIndex("by_deadline").take(500);

    const directory = await loadUserDirectory(ctx);
    return features
      .filter((f) => showEmptyFeatures || byFeature.has(f._id))
      .map((f) => ({
        feature: toFeatureSummary(f),
        tasks: (byFeature.get(f._id) ?? []).sort(compareTasks).map((t) => toTaskView(t, directory)),
      }));
  },
});

/** One task with its feature. Null if it doesn't exist. */
export const get = query({
  args: { taskId: v.id("tasks") },
  returns: v.union(
    v.null(),
    v.object({ task: taskViewValidator, feature: schema.doc("features") })
  ),
  handler: async (ctx, { taskId }) => {
    await requireUser(ctx);
    const task = await ctx.db.get("tasks", taskId);
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
    const feature = await requireFeature(ctx, task.featureId);
    const plan = await validateTaskPlan(ctx, feature, input, Date.now(), task.deadline);

    const changes = diffFields(task, plan);
    if (changes === null) return null;
    await ctx.db.patch("tasks", taskId, plan);
    await logActivity(ctx, {
      actorId: admin._id,
      entityType: "task",
      entityId: taskId,
      action: "task.updated",
      ...changes,
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
      action: "task.proposal_declined",
      before: { status: task.status },
      after: { status: "declined", declineReason },
    });
    return null;
  },
});
