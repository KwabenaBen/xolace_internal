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
  /** The nearest upcoming deadline (or, if nothing is upcoming, the most overdue task). */
  nextUp: { task: TaskView; featureTitle: string } | null;
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
  let upcoming: { task: TaskView; featureTitle: string } | null = null;
  let late: { task: TaskView; featureTitle: string } | null = null;
  let total = 0;
  let myOpen = 0;

  for (const { feature, tasks } of groups) {
    for (const task of tasks) {
      if (task.status === "proposed" || task.status === "declined") continue;
      total++;
      byStatus[task.status]++;
      if (task.ownerId === userId && task.status !== "verified") myOpen++;
      if (isDueSoon(task, now)) dueSoon.push(task);
      if (isOverdue(task, now)) overdue.push(task);
      if (task.status === "verified" || task.deadline === undefined) continue;
      if (task.deadline >= now) {
        if (upcoming === null || task.deadline < (upcoming.task.deadline ?? Infinity)) {
          upcoming = { task, featureTitle: feature.title };
        }
      } else if (late === null || task.deadline < (late.task.deadline ?? Infinity)) {
        late = { task, featureTitle: feature.title };
      }
    }
  }
  return { total, byStatus, dueSoon, overdue, nextUp: upcoming ?? late, myOpen };
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
