import { v, type Infer } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import schema from "../schema";

/**
 * Shapes the app receives for features and tasks: documents plus the names it needs to
 * display (owner, reviewer, proposer), so screens don't make a query per person.
 */

export const userSummaryValidator = v.object({
  _id: v.id("users"),
  name: v.string(),
  title: v.string(),
  isActive: v.boolean(),
});
export type UserSummary = Infer<typeof userSummaryValidator>;

export type UserDirectory = Map<Id<"users">, UserSummary>;

/** Everyone, keyed by id. The team is small, so one read beats one per task. */
export async function loadUserDirectory(ctx: QueryCtx): Promise<UserDirectory> {
  const users = await ctx.db.query("users").take(500);
  return new Map(
    users.map((u) => [u._id, { _id: u._id, name: u.name, title: u.title, isActive: u.isActive }])
  );
}

function lookup(directory: UserDirectory, id: Id<"users"> | undefined): UserSummary | null {
  return id === undefined ? null : (directory.get(id) ?? null);
}

export const taskViewValidator = schema.doc("tasks").extend({
  owner: v.union(userSummaryValidator, v.null()),
  peerReviewer: v.union(userSummaryValidator, v.null()),
  proposer: v.union(userSummaryValidator, v.null()),
});
export type TaskView = Infer<typeof taskViewValidator>;

export function toTaskView(task: Doc<"tasks">, directory: UserDirectory): TaskView {
  return {
    ...task,
    owner: lookup(directory, task.ownerId),
    peerReviewer: lookup(directory, task.peerReviewerId),
    proposer: lookup(directory, task.proposedBy),
  };
}

export const featureSummaryValidator = schema
  .doc("features")
  .pick("_id", "_creationTime", "title", "deadline", "status");
export type FeatureSummary = Infer<typeof featureSummaryValidator>;

export function toFeatureSummary(feature: Doc<"features">): FeatureSummary {
  return {
    _id: feature._id,
    _creationTime: feature._creationTime,
    title: feature.title,
    deadline: feature.deadline,
    status: feature.status,
  };
}

/** Summaries of the features these tasks belong to (each feature once). */
export async function loadFeatureSummaries(
  ctx: QueryCtx,
  tasks: Doc<"tasks">[]
): Promise<FeatureSummary[]> {
  const summaries: FeatureSummary[] = [];
  for (const id of new Set(tasks.map((t) => t.featureId))) {
    const feature = await ctx.db.get("features", id);
    if (feature !== null) summaries.push(toFeatureSummary(feature));
  }
  return summaries;
}

/** Orders live tasks by deadline, then priority (urgent first), then creation. */
const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 } as const;
export function compareTasks(a: Doc<"tasks">, b: Doc<"tasks">): number {
  const deadlineA = a.deadline ?? Number.MAX_SAFE_INTEGER;
  const deadlineB = b.deadline ?? Number.MAX_SAFE_INTEGER;
  if (deadlineA !== deadlineB) return deadlineA - deadlineB;
  if (a.priority !== b.priority) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  return a._creationTime - b._creationTime;
}
