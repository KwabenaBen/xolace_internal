import type { Id } from "@convex/_generated/dataModel";
import type { LiveTaskStatus } from "@convex/lib/validators";
import type { FeatureSummary, TaskView } from "@convex/lib/views";

const WEEK = 7 * 24 * 60 * 60 * 1000;

export type BoardGroup = { feature: FeatureSummary; tasks: TaskView[] };

export type BoardStats = {
  total: number;
  byStatus: Record<LiveTaskStatus, number>;
  /** Not verified, due within the next 7 days. */
  dueSoon: TaskView[];
  /** Not verified and past the deadline. */
  overdue: TaskView[];
  /**
   * The feature that needs attention next: the unshipped feature with the nearest deadline from
   * today, or, if every unshipped one is past its deadline, the most overdue.
   */
  nextUp: { feature: FeatureSummary; progress: FeatureProgress } | null;
  /** The signed-in user's open (not verified) tasks. */
  myOpen: number;
};

const EMPTY_COUNTS: Record<LiveTaskStatus, number> = {
  todo: 0,
  in_progress: 0,
  blocked: 0,
  in_peer_review: 0,
  submitted: 0,
  verified: 0,
  changes_requested: 0,
};

export type FeatureProgress = {
  /** Live tasks (proposals and declined ones don't count). */
  total: number;
  verified: number;
  /** The average of the tasks' progress, a verified task counting as 100%. 0 with no tasks. */
  percent: number;
};

/** How far a feature has got, from its tasks. */
export function featureProgress(tasks: readonly TaskView[]): FeatureProgress {
  let total = 0;
  let verified = 0;
  let sum = 0;
  for (const task of tasks) {
    if (task.status === "proposed" || task.status === "declined") continue;
    total++;
    if (task.status === "verified") {
      verified++;
      sum += 100;
    } else {
      sum += Math.max(0, Math.min(100, task.progress));
    }
  }
  return { total, verified, percent: total === 0 ? 0 : Math.round(sum / total) };
}

export function isOverdue(task: TaskView, now: number): boolean {
  return task.status !== "verified" && task.deadline !== undefined && task.deadline < now;
}

export function isDueSoon(task: TaskView, now: number): boolean {
  return (
    task.status !== "verified" &&
    task.deadline !== undefined &&
    task.deadline >= now &&
    task.deadline <= now + WEEK
  );
}

/** Everything the bento tiles show, from the unfiltered board. */
export function computeBoardStats(
  groups: BoardGroup[],
  now: number,
  userId: Id<"users">
): BoardStats {
  const byStatus = { ...EMPTY_COUNTS };
  const dueSoon: TaskView[] = [];
  const overdue: TaskView[] = [];
  let upcoming: BoardGroup | null = null;
  let late: BoardGroup | null = null;
  let total = 0;
  let myOpen = 0;

  for (const group of groups) {
    const { feature, tasks } = group;
    if (feature.status !== "shipped") {
      if (feature.deadline >= now) {
        if (upcoming === null || feature.deadline < upcoming.feature.deadline) upcoming = group;
      } else if (late === null || feature.deadline < late.feature.deadline) {
        late = group;
      }
    }
    for (const task of tasks) {
      if (task.status === "proposed" || task.status === "declined") continue;
      total++;
      byStatus[task.status]++;
      if (task.ownerId === userId && task.status !== "verified") myOpen++;
      if (isDueSoon(task, now)) dueSoon.push(task);
      if (isOverdue(task, now)) overdue.push(task);
    }
  }
  const next = upcoming ?? late;
  return {
    total,
    byStatus,
    dueSoon,
    overdue,
    nextUp: next === null ? null : { feature: next.feature, progress: featureProgress(next.tasks) },
    myOpen,
  };
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
