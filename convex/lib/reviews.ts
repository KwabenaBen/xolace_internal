import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { logActivity } from "./activity";
import { appError } from "./errors";
import { isLiveTask } from "./tasks";
import type { FeatureStatus, TaskStatus } from "./validators";

/**
 * Peer review and verification rules (Phase 6), shared by convex/reviews.ts and the queries the
 * app reads them through. Each request is a `verifications` row: stage "peer_review" (code tasks,
 * decided by the task's peer reviewer) or "verification" (decided by an admin, or for an admin's
 * own task the admin task reviewer: loadDeciders, convex/lib/extensions.ts). A row is pending until
 * it's decided or the owner takes it back.
 */

/** Where the owner can ask for a peer review or submit from: the task is in their hands. */
export const READY_STATUSES = [
  "todo",
  "in_progress",
  "changes_requested",
] as const satisfies readonly TaskStatus[];

export function isReady(status: TaskStatus): boolean {
  return (READY_STATUSES as readonly TaskStatus[]).includes(status);
}

/** Limits on what a request or a decision carries. */
export const REVIEW_LIMITS = { note: 1000, url: 500 } as const;

export function isPending(row: Doc<"verifications">): boolean {
  return row.decision === undefined && row.withdrawnAt === undefined;
}

/** A task's requests, oldest first. */
export async function loadReviews(
  ctx: QueryCtx,
  taskId: Id<"tasks">
): Promise<Doc<"verifications">[]> {
  const rows = await ctx.db
    .query("verifications")
    .withIndex("by_taskId_and_stage", (q) => q.eq("taskId", taskId))
    .take(200);
  return rows.sort((a, b) => a._creationTime - b._creationTime);
}

/**
 * Whether a code task's latest peer review approved it since anyone last asked for changes (its
 * peer reviewer or a verifier): the owner may then submit it. After changes are requested the code
 * changes, so it goes through peer review again (the user's rule, 14 Nov).
 */
export function hasCurrentPeerApproval(rows: Doc<"verifications">[]): boolean {
  // Requests come one at a time (a new one only once the last was decided or taken back), so the
  // rows in the order they were made (`loadReviews`) are also the order of their decisions.
  let approved = false;
  for (const row of [...rows].sort((a, b) => a._creationTime - b._creationTime)) {
    if (row.stage === "peer_review" && row.decision === "approved") approved = true;
    if (row.decision === "changes_requested") approved = false;
  }
  return approved;
}

/** A proof link: empty, or an http(s) URL. */
export function cleanProofUrl(value: string | undefined): string | undefined {
  const url = (value ?? "").trim();
  if (url === "") return undefined;
  if (url.length > REVIEW_LIMITS.url) {
    throw appError(
      "INVALID_ARGUMENT",
      `The link must be ${REVIEW_LIMITS.url} characters or fewer.`
    );
  }
  if (!/^https?:\/\/[^\s]+$/i.test(url)) {
    throw appError("INVALID_ARGUMENT", "The link must start with https:// (or http://).");
  }
  return url;
}

/**
 * A feature's stage follows its tasks: Planned becomes In progress once a live task has started;
 * it becomes Internal testing once every live task is verified (at least one), and goes back to
 * In progress if one isn't any more (a task was added). Shipped is the admin's call
 * (features.markShipped) and never changes here. A change is an activity entry with no actor.
 */
export async function rollUpFeature(ctx: MutationCtx, featureId: Id<"features">): Promise<void> {
  const feature = await ctx.db.get("features", featureId);
  if (feature === null || feature.status === "shipped") return;
  const tasks = (
    await ctx.db
      .query("tasks")
      .withIndex("by_featureId_and_status", (q) => q.eq("featureId", featureId))
      .take(500)
  ).filter(isLiveTask);
  const allVerified = tasks.length > 0 && tasks.every((t) => t.status === "verified");
  const started = tasks.some((t) => t.status !== "todo" || t.progress > 0);
  let next: FeatureStatus = feature.status;
  if (allVerified) next = "internal_testing";
  else if (feature.status === "internal_testing") next = "in_progress";
  else if (feature.status === "planned" && started) next = "in_progress";
  if (next === feature.status) return;
  await ctx.db.patch("features", featureId, { status: next });
  await logActivity(ctx, {
    entityType: "feature",
    entityId: featureId,
    action: "feature.status_changed",
    before: { status: feature.status },
    after: { status: next },
  });
}
