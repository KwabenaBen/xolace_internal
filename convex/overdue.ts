import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { logActivity } from "./lib/activity";
import type { TaskStatus } from "./lib/validators";

/** Live statuses whose deadline still matters: everything but verified. */
const UNVERIFIED: readonly TaskStatus[] = [
  "todo",
  "in_progress",
  "blocked",
  "in_peer_review",
  "submitted",
  "changes_requested",
];

/**
 * Flags tasks whose deadline has passed without verification (requirements: "flagged
 * automatically"). Run every hour by convex/crons.ts; deadlines are the end of a day in GMT, so
 * the run just after midnight catches each day's. Each newly overdue task gets `overdueSince` and
 * an activity entry with no actor (the system did it). The flag is cleared when the deadline
 * moves to a later date (an approved extension, or an admin's edit).
 */
export const flag = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    let flagged = 0;
    for (const status of UNVERIFIED) {
      // Not yet flagged and past the deadline (the index skips the ones already flagged).
      const pastDeadline = await ctx.db
        .query("tasks")
        .withIndex("by_status_and_overdueSince_and_deadline", (q) =>
          q.eq("status", status).eq("overdueSince", undefined).lt("deadline", now)
        )
        .take(1000);
      for (const task of pastDeadline) {
        if (task.deadline === undefined || task.overdueSince !== undefined) continue;
        await ctx.db.patch("tasks", task._id, { overdueSince: now });
        await logActivity(ctx, {
          entityType: "task",
          entityId: task._id,
          taskId: task._id,
          action: "task.became_overdue",
          after: { deadline: task.deadline },
        });
        flagged++;
      }
    }
    return flagged;
  },
});
