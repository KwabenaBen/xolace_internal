import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { logActivity } from "./lib/activity";
import { requireUser } from "./lib/auth";
import { appError } from "./lib/errors";
import {
  deciderValidator,
  extensionViewValidator,
  loadDeciders,
  toExtensionView,
} from "./lib/extensions";
import { isLateExtension } from "./lib/lateRule";
import { getSettingValue } from "./lib/settings";
import {
  cleanText,
  isLiveTask,
  LIMITS,
  parseDeadline,
  requireFeature,
  requireTask,
} from "./lib/tasks";
import { extensionTypeValidator, isOwnerWorking } from "./lib/validators";
import { loadUserDirectory } from "./lib/views";

/**
 * Deadline extensions (docs/REQUIREMENTS.md → "Deadline extensions"). A task's owner asks for a
 * later date with a reason and a type; the admins decide, or the admin task reviewer when an
 * admin owns the task (convex/lib/extensions.ts). One request at a time per task. Approving
 * moves the task's deadline (the original stays on record), the feature's too if the new date is
 * later, clears the overdue flag, and applies the late rule (convex/lib/lateRule.ts).
 */

/** Owner: ask for a later deadline. */
export const request = mutation({
  args: {
    taskId: v.id("tasks"),
    newDeadline: v.string(), // "YYYY-MM-DD"
    type: extensionTypeValidator,
    reason: v.string(),
  },
  returns: v.id("extensionRequests"),
  handler: async (ctx, { taskId, newDeadline, type, reason }) => {
    const user = await requireUser(ctx);
    const task = await requireTask(ctx, taskId);
    if (!isLiveTask(task) || task.deadline === undefined) {
      throw appError("INVALID_ARGUMENT", "Only live tasks have a deadline to extend.");
    }
    if (task.ownerId !== user._id) {
      throw appError("FORBIDDEN", "Only the task's owner can ask for more time.");
    }
    if (!isOwnerWorking(task.status)) {
      throw appError(
        "INVALID_ARGUMENT",
        "This task is with its reviewer or already verified, so its deadline can't be extended."
      );
    }
    const feature = await requireFeature(ctx, task.featureId);
    if (feature.status === "shipped") {
      throw appError("INVALID_ARGUMENT", "This feature has shipped; its deadlines are final.");
    }
    const pending = await ctx.db
      .query("extensionRequests")
      .withIndex("by_taskId_and_status", (q) => q.eq("taskId", taskId).eq("status", "pending"))
      .first();
    if (pending !== null) {
      throw appError("CONFLICT", "This task already has a request waiting for a decision.");
    }

    const now = Date.now();
    const requestedDeadline = parseDeadline(newDeadline, now);
    if (requestedDeadline <= task.deadline) {
      throw appError("INVALID_ARGUMENT", "Pick a date after the task's current deadline.");
    }
    const why = cleanText(reason, "Reason", { required: true, max: LIMITS.reason });
    const beyondFeatureDeadline = requestedDeadline > feature.deadline;

    const requestId = await ctx.db.insert("extensionRequests", {
      taskId,
      requestedBy: user._id,
      requestedAt: now,
      currentDeadline: task.deadline,
      requestedDeadline,
      reason: why,
      type,
      status: "pending",
      beyondFeatureDeadline,
    });
    await logActivity(ctx, {
      actorId: user._id,
      entityType: "extensionRequest",
      entityId: requestId,
      taskId,
      action: "extension.requested",
      after: {
        currentDeadline: task.deadline,
        requestedDeadline,
        type,
        reason: why,
        beyondFeatureDeadline,
      },
    });
    return requestId;
  },
});

/** The decider: approve or decline a waiting request. Declining needs a reason. */
export const decide = mutation({
  args: {
    requestId: v.id("extensionRequests"),
    approve: v.boolean(),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { requestId, approve, note }) => {
    const user = await requireUser(ctx);
    const request = await ctx.db.get("extensionRequests", requestId);
    if (request === null) throw appError("NOT_FOUND", "That request doesn't exist.");
    if (request.status !== "pending") {
      throw appError("CONFLICT", "This request has already been decided.");
    }
    const task = await requireTask(ctx, request.taskId);
    const deciders = await loadDeciders(ctx);
    if (!(await deciders.canDecide(user, task))) {
      throw appError(
        "FORBIDDEN",
        task.ownerId === user._id
          ? "You can't decide on your own extension."
          : "Only the person who decides this task's extensions can do this."
      );
    }
    const decisionNote = cleanText(note ?? "", "Reason", {
      required: !approve,
      max: LIMITS.reason,
    });
    const now = Date.now();

    if (!approve) {
      await ctx.db.patch("extensionRequests", requestId, {
        status: "declined",
        reviewerId: user._id,
        decidedAt: now,
        decisionNote,
      });
      await logActivity(ctx, {
        actorId: user._id,
        entityType: "extensionRequest",
        entityId: requestId,
        taskId: task._id,
        action: "extension.declined",
        before: { status: "pending" },
        after: { status: "declined", note: decisionNote },
      });
      return null;
    }

    if (task.status === "verified") {
      throw appError("INVALID_ARGUMENT", "This task is already verified; it needs no more time.");
    }
    if (task.deadline !== undefined && request.requestedDeadline <= task.deadline) {
      throw appError(
        "INVALID_ARGUMENT",
        "The task's deadline has already moved to this date or later. Decline this request instead."
      );
    }
    if (request.requestedDeadline < now) {
      throw appError(
        "INVALID_ARGUMENT",
        "The date asked for has passed. Decline this, and they can ask for a new date."
      );
    }

    const windowValue = await getSettingValue(ctx, "extensionLateWindowHours");
    const late = isLateExtension({
      type: request.type,
      requestedAt: request.requestedAt,
      currentDeadline: request.currentDeadline,
      windowHours: typeof windowValue === "number" ? windowValue : 24,
    });

    await ctx.db.patch("extensionRequests", requestId, {
      status: "approved",
      reviewerId: user._id,
      decidedAt: now,
      decisionNote: decisionNote === "" ? undefined : decisionNote,
      countsAsLate: late,
    });
    await ctx.db.patch("tasks", task._id, {
      deadline: request.requestedDeadline,
      countsAsLate: task.countsAsLate || late,
      // The new date is ahead (checked above), so it's no longer overdue.
      overdueSince: undefined,
    });
    await logActivity(ctx, {
      actorId: user._id,
      entityType: "extensionRequest",
      entityId: requestId,
      taskId: task._id,
      action: "extension.approved",
      before: { status: "pending", deadline: task.deadline },
      after: {
        status: "approved",
        deadline: request.requestedDeadline,
        countsAsLate: late,
        ...(decisionNote !== "" ? { note: decisionNote } : {}),
      },
    });

    // A task's deadline never passes its feature's: a later date moves the feature too.
    const feature = await requireFeature(ctx, task.featureId);
    if (request.requestedDeadline > feature.deadline) {
      await ctx.db.patch("features", feature._id, { deadline: request.requestedDeadline });
      await logActivity(ctx, {
        actorId: user._id,
        entityType: "feature",
        entityId: feature._id,
        taskId: task._id,
        action: "feature.deadline_extended",
        before: { deadline: feature.deadline },
        after: { deadline: request.requestedDeadline },
      });
    }
    return null;
  },
});

/** A task's extension requests, newest first, and whether the caller decides them. */
export const forTask = query({
  args: { taskId: v.id("tasks") },
  returns: v.object({
    requests: v.array(extensionViewValidator),
    canDecide: v.boolean(),
    decider: deciderValidator,
  }),
  handler: async (ctx, { taskId }) => {
    const user = await requireUser(ctx);
    const task = await requireTask(ctx, taskId);
    const requests = await ctx.db
      .query("extensionRequests")
      .withIndex("by_taskId_and_status", (q) => q.eq("taskId", taskId))
      .take(100);
    const directory = await loadUserDirectory(ctx);
    const deciders = await loadDeciders(ctx);
    return {
      requests: requests
        .sort((a, b) => b.requestedAt - a.requestedAt)
        .map((r) => toExtensionView(r, directory)),
      canDecide: await deciders.canDecide(user, task),
      decider: await deciders.deciderOf(task),
    };
  },
});

/** The requests waiting for the caller's decision, oldest first, with their task and feature. */
export const waitingOnMe = query({
  args: {},
  returns: v.array(
    v.object({
      request: extensionViewValidator,
      task: v.object({ _id: v.id("tasks"), title: v.string() }),
      feature: v.object({ _id: v.id("features"), title: v.string(), deadline: v.number() }),
    })
  ),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const pending = await ctx.db
      .query("extensionRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(200);
    const directory = await loadUserDirectory(ctx);
    const deciders = await loadDeciders(ctx);
    const rows = [];
    for (const request of pending) {
      const task = await ctx.db.get("tasks", request.taskId);
      if (task === null || !(await deciders.canDecide(user, task))) continue;
      const feature = await ctx.db.get("features", task.featureId);
      if (feature === null) continue;
      rows.push({
        request: toExtensionView(request, directory),
        task: { _id: task._id, title: task.title },
        feature: { _id: feature._id, title: feature.title, deadline: feature.deadline },
      });
    }
    return rows;
  },
});
