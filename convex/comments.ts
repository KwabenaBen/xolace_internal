import { v } from "convex/values";

import { mutation } from "./_generated/server";
import { logActivity } from "./lib/activity";
import { requireUser } from "./lib/auth";
import { appError } from "./lib/errors";
import { cleanText, LIMITS, requireTask } from "./lib/tasks";

/**
 * Comments on a task. Anyone can comment on any task (everyone sees everything), except a
 * declined proposal, which is closed. Comments are part of the record: they can't be edited or
 * deleted. Each one is also an activity entry tagged with its task, which is how the task page
 * shows them in its history (activity.forTask).
 */
export const add = mutation({
  args: { taskId: v.id("tasks"), body: v.string() },
  returns: v.id("comments"),
  handler: async (ctx, { taskId, body }) => {
    const user = await requireUser(ctx);
    const task = await requireTask(ctx, taskId);
    if (task.status === "declined") {
      throw appError("INVALID_ARGUMENT", "This proposal was declined, so it's closed.");
    }
    const text = cleanText(body, "Comment", { required: true, max: LIMITS.comment });
    const commentId = await ctx.db.insert("comments", { taskId, authorId: user._id, body: text });
    await logActivity(ctx, {
      actorId: user._id,
      entityType: "comment",
      entityId: commentId,
      taskId,
      action: "comment.added",
      after: { body: text },
    });
    return commentId;
  },
});
