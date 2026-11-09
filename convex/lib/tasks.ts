import { v, type ObjectType } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { requireAssignableUser } from "./auth";
import { endOfDayGmt, toDateOnly } from "./dates";
import { appError } from "./errors";
import { taskKindValidator, taskPriorityValidator } from "./validators";

/** Length limits for user-entered text. */
export const LIMITS = {
  title: 120,
  description: 4000,
  expectedResult: 2000,
  sourceNote: 500,
  criterion: 300,
  criteria: 20,
  reason: 1000,
} as const;

/** Trims `value`; throws INVALID_ARGUMENT if it's required and empty, or too long. */
export function cleanText(
  value: string,
  label: string,
  { required, max }: { required: boolean; max: number }
): string {
  const text = value.trim();
  if (required && text.length === 0) throw appError("INVALID_ARGUMENT", `${label} is required.`);
  if (text.length > max) {
    throw appError("INVALID_ARGUMENT", `${label} must be ${max} characters or fewer.`);
  }
  return text;
}

/** Trims criteria and drops blank ones. Live tasks need at least one. */
export function cleanCriteria(criteria: string[], { required }: { required: boolean }): string[] {
  const cleaned = criteria.map((c) => c.trim()).filter((c) => c.length > 0);
  if (required && cleaned.length === 0) {
    throw appError("INVALID_ARGUMENT", "Add at least one acceptance criterion.");
  }
  if (cleaned.length > LIMITS.criteria) {
    throw appError("INVALID_ARGUMENT", `Use at most ${LIMITS.criteria} acceptance criteria.`);
  }
  if (cleaned.some((c) => c.length > LIMITS.criterion)) {
    throw appError(
      "INVALID_ARGUMENT",
      `Each acceptance criterion must be ${LIMITS.criterion} characters or fewer.`
    );
  }
  return cleaned;
}

/** "YYYY-MM-DD" → end of that day in GMT. Throws if invalid or already past. */
export function parseDeadline(dateOnly: string, now: number): number {
  const deadline = endOfDayGmt(dateOnly);
  if (deadline === null) throw appError("INVALID_ARGUMENT", "Pick a valid deadline date.");
  if (deadline < now) throw appError("INVALID_ARGUMENT", "The deadline can't be in the past.");
  return deadline;
}

export async function requireFeature(
  ctx: QueryCtx,
  featureId: Id<"features">
): Promise<Doc<"features">> {
  const feature = await ctx.db.get("features", featureId);
  if (feature === null) throw appError("NOT_FOUND", "That feature doesn't exist.");
  return feature;
}

export async function requireTask(ctx: QueryCtx, taskId: Id<"tasks">): Promise<Doc<"tasks">> {
  const task = await ctx.db.get("tasks", taskId);
  if (task === null) throw appError("NOT_FOUND", "That task doesn't exist.");
  return task;
}

/** Arguments for planning a live task: create, edit, and approving a proposal. */
export const taskPlanArgs = {
  title: v.string(),
  description: v.string(),
  kind: taskKindValidator,
  acceptanceCriteria: v.array(v.string()),
  ownerId: v.id("users"),
  peerReviewerId: v.optional(v.id("users")),
  deadline: v.string(), // "YYYY-MM-DD"
  priority: taskPriorityValidator,
};
export type TaskPlanInput = ObjectType<typeof taskPlanArgs>;

export type TaskPlan = {
  title: string;
  description: string;
  kind: TaskPlanInput["kind"];
  acceptanceCriteria: string[];
  ownerId: Id<"users">;
  peerReviewerId: Id<"users"> | undefined;
  deadline: number;
  priority: TaskPlanInput["priority"];
};

/**
 * Validates everything a live task needs and returns the cleaned fields:
 * owner (and reviewer for code tasks) active and different, at least one criterion, and a
 * deadline that isn't past and falls on or before the feature's.
 */
export async function validateTaskPlan(
  ctx: QueryCtx,
  feature: Doc<"features">,
  input: TaskPlanInput,
  now: number,
  /** When editing: the task's current deadline, kept as-is if the date wasn't changed. */
  currentDeadline?: number
): Promise<TaskPlan> {
  if (feature.status === "shipped") {
    throw appError("INVALID_ARGUMENT", "This feature has shipped; it can't take new work.");
  }
  const title = cleanText(input.title, "Title", { required: true, max: LIMITS.title });
  const description = cleanText(input.description, "Description", {
    required: false,
    max: LIMITS.description,
  });
  const acceptanceCriteria = cleanCriteria(input.acceptanceCriteria, { required: true });

  // An unchanged date stays valid even once it has passed (e.g. editing an overdue task).
  const deadline =
    currentDeadline !== undefined && toDateOnly(currentDeadline) === input.deadline
      ? currentDeadline
      : parseDeadline(input.deadline, now);
  if (deadline > feature.deadline) {
    throw appError(
      "INVALID_ARGUMENT",
      "The task's deadline must be on or before the feature's deadline."
    );
  }

  await requireAssignableUser(ctx, input.ownerId);
  let peerReviewerId: Id<"users"> | undefined;
  if (input.kind === "code") {
    if (input.peerReviewerId === undefined) {
      throw appError("INVALID_ARGUMENT", "Code tasks need a peer reviewer.");
    }
    if (input.peerReviewerId === input.ownerId) {
      throw appError("INVALID_ARGUMENT", "The peer reviewer can't be the task's owner.");
    }
    await requireAssignableUser(ctx, input.peerReviewerId);
    peerReviewerId = input.peerReviewerId;
  }

  return {
    title,
    description,
    kind: input.kind,
    acceptanceCriteria,
    ownerId: input.ownerId,
    peerReviewerId,
    deadline,
    priority: input.priority,
  };
}

/** Latest deadline among a feature's tasks that count (not declined), or null if none. */
export async function latestTaskDeadline(
  ctx: QueryCtx,
  featureId: Id<"features">
): Promise<number | null> {
  const tasks = await ctx.db
    .query("tasks")
    .withIndex("by_featureId_and_status", (q) => q.eq("featureId", featureId))
    .take(500);
  let latest: number | null = null;
  for (const task of tasks) {
    if (task.status === "declined" || task.deadline === undefined) continue;
    if (latest === null || task.deadline > latest) latest = task.deadline;
  }
  return latest;
}
