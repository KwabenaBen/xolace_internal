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
};

/** Appends one row to the audit trail. Call it from every mutation that changes data. */
export async function logActivity(ctx: MutationCtx, entry: ActivityEntry): Promise<void> {
  await ctx.db.insert("activity", { ...entry, timestamp: Date.now() });
}
