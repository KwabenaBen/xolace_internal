import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { logActivity } from "./activity";
import { REVIEW_LIMITS } from "./constants";
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

export function isPending(row: Doc<"verifications">): boolean {
  return row.decision === undefined && row.withdrawnAt === undefined;
}

/**
 * A task's requests, oldest first. A task has at most `REVIEW_LIMITS.requestsPerTask` of them
 * (`requireRoomForRequest`), so this reads them all.
 */
export async function loadReviews(
  ctx: QueryCtx,
  taskId: Id<"tasks">
): Promise<Doc<"verifications">[]> {
  const rows = await ctx.db
    .query("verifications")
    .withIndex("by_taskId_and_stage", (q) => q.eq("taskId", taskId))
    .take(REVIEW_LIMITS.requestsPerTask * 2);
  return rows.sort((a, b) => a._creationTime - b._creationTime);
}

/** Refuses a new request once a task has had `REVIEW_LIMITS.requestsPerTask`. */
export function requireRoomForRequest(rows: Doc<"verifications">[]): void {
  if (rows.length >= REVIEW_LIMITS.requestsPerTask) {
    throw appError(
      "INVALID_ARGUMENT",
      `This task has had ${REVIEW_LIMITS.requestsPerTask} reviews, the most one task can have. Ask an admin to split the work into a new task.`
    );
  }
}

/**
 * Whether a code task's latest peer review approved it since anyone last asked for changes (its
 * peer reviewer or a verifier): the owner may then submit it. After changes are requested the code
 * changes, so it goes through peer review again (the user's rule, 14 Nov). Only an approval by the
 * task's current peer reviewer, of a request from its current owner, counts: a new owner or
 * reviewer means a new review (an old reviewer made owner can't submit on their own approval).
 */
export function hasCurrentPeerApproval(
  rows: Doc<"verifications">[],
  task: Pick<Doc<"tasks">, "ownerId" | "peerReviewerId">
): boolean {
  // Requests come one at a time (a new one only once the last was decided or taken back), so the
  // rows in the order they were made (`loadReviews`) are also the order of their decisions.
  let approved = false;
  for (const row of [...rows].sort((a, b) => a._creationTime - b._creationTime)) {
    if (row.stage === "peer_review" && row.decision === "approved") {
      approved =
        task.peerReviewerId !== undefined &&
        row.reviewerId === task.peerReviewerId &&
        row.submittedBy === task.ownerId &&
        row.reviewerId !== task.ownerId;
    }
    if (row.decision === "changes_requested") approved = false;
  }
  return approved;
}

/** Control characters, and invisible ones that can disguise a link (zero-width, text direction). */
function hasHiddenCharacters(text: string): boolean {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (
      code < 0x20 ||
      (code >= 0x7f && code <= 0x9f) ||
      (code >= 0x200b && code <= 0x200f) ||
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2060 && code <= 0x2069) ||
      code === 0xfeff
    ) {
      return true;
    }
  }
  return false;
}

/**
 * A proof link: empty, or an http(s) URL with no user name or password and nothing hidden in it.
 * Stored in its standard form (`URL.href`), so a look-alike host shows as `xn--…`.
 */
export function cleanProofUrl(value: string | undefined): string | undefined {
  const raw = (value ?? "").trim();
  if (raw === "") return undefined;
  const tooLong = () =>
    appError("INVALID_ARGUMENT", `The link must be ${REVIEW_LIMITS.url} characters or fewer.`);
  if (raw.length > REVIEW_LIMITS.url) throw tooLong();
  const notALink = appError("INVALID_ARGUMENT", "The link must start with https:// (or http://).");
  if (!/^https?:\/\//i.test(raw)) throw notALink;
  if (/\s/.test(raw) || hasHiddenCharacters(raw)) {
    throw appError("INVALID_ARGUMENT", "The link has spaces or hidden characters in it.");
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw notALink;
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.hostname === "") {
    throw notALink;
  }
  if (url.username !== "" || url.password !== "") {
    throw appError("INVALID_ARGUMENT", "The link can't contain a user name or password.");
  }
  if (url.href.length > REVIEW_LIMITS.url) throw tooLong();
  return url.href;
}

/**
 * A feature's stage follows its tasks: Planned becomes In progress once a live task has started;
 * it becomes Internal testing once every live task is verified (at least one), and goes back to
 * In progress if one isn't any more (a task was added). Shipped is the admin's call
 * (features.markShipped) and never changes here. A change is an activity entry with no actor,
 * tagged with the task whose change moved it (`taskId`), so it shows in that task's history.
 */
export async function rollUpFeature(
  ctx: MutationCtx,
  featureId: Id<"features">,
  taskId?: Id<"tasks">
): Promise<void> {
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
    ...(taskId !== undefined ? { taskId } : {}),
    action: "feature.status_changed",
    before: { status: feature.status },
    after: { status: next },
  });
}
