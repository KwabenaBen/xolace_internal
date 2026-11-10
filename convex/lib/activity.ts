import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { ActivityEntityType } from "./validators";

export type ActivityEntry = {
  actorId?: Id<"users">; // omit for scheduled jobs
  entityType: ActivityEntityType;
  entityId: string;
  action: string; // "<entity>.<verb>", e.g. "user.deactivated"
  before?: unknown;
  after?: unknown;
  /** The task the entry is about, for that task's history (convex/activity.ts → forTask). */
  taskId?: Id<"tasks">;
};

/**
 * The fields that differ between `before` and `after` (compared as JSON), as two objects
 * holding just those keys, for an activity entry's before/after. Null when nothing changed.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>
): { before: Partial<T>; after: Partial<T> } | null {
  const changedBefore: Partial<T> = {};
  const changedAfter: Partial<T> = {};
  let changed = false;
  for (const key of Object.keys(after) as (keyof T)[]) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changedBefore[key] = before[key];
      changedAfter[key] = after[key];
      changed = true;
    }
  }
  return changed ? { before: changedBefore, after: changedAfter } : null;
}

/** Appends one row to the audit trail. Call it from every mutation that changes data. */
export async function logActivity(ctx: MutationCtx, entry: ActivityEntry): Promise<void> {
  await ctx.db.insert("activity", { ...entry, timestamp: Date.now() });
}
