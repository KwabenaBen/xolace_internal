import type { Id } from "@convex/_generated/dataModel";
import type { LiveTaskStatus } from "@convex/lib/validators";
import type { FeatureSummary, TaskView, UserSummary } from "@convex/lib/views";

import type { BoardGroup } from "@/components/board/board-stats";

/**
 * The web Board's filters: a person (the chips), a status, and the search box. They work on the
 * unfiltered board in the browser: `tasks.board` reads each feature's tasks in full, so this
 * matches what the server's own filters would return.
 */
export type BoardFilter = {
  ownerId: Id<"users"> | null;
  status: LiveTaskStatus | null;
  query: string;
};

export const NO_FILTER: BoardFilter = { ownerId: null, status: null, query: "" };

export function isFiltering(filter: BoardFilter): boolean {
  return filter.ownerId !== null || filter.status !== null || filter.query.trim() !== "";
}

function includes(text: string, query: string): boolean {
  return text.toLowerCase().includes(query);
}

export function matchesTask(task: TaskView, feature: FeatureSummary, filter: BoardFilter): boolean {
  if (task.status === "proposed" || task.status === "declined") return false;
  if (filter.ownerId !== null && task.ownerId !== filter.ownerId) return false;
  if (filter.status !== null && task.status !== filter.status) return false;
  const query = filter.query.trim().toLowerCase();
  if (query === "") return true;
  return (
    includes(task.title, query) ||
    includes(feature.title, query) ||
    (task.owner !== null && includes(task.owner.name, query))
  );
}

/**
 * The feature cards to show: every feature, or with a filter the ones with a matching task (and,
 * when only searching, the ones whose title matches).
 */
export function visibleFeatures(groups: BoardGroup[], filter: BoardFilter): BoardGroup[] {
  if (!isFiltering(filter)) return groups;
  const query = filter.query.trim().toLowerCase();
  const titleSearch = filter.ownerId === null && filter.status === null && query !== "";
  return groups.filter(
    ({ feature, tasks }) =>
      (titleSearch && includes(feature.title, query)) ||
      tasks.some((task) => matchesTask(task, feature, filter))
  );
}

export type TaskWithFeature = { task: TaskView; feature: FeatureSummary };

/**
 * The "Coming up" table: matching tasks, soonest deadline first (so late ones lead). Verified
 * work is left out unless "Verified" is the status picked.
 */
export function upcomingTasks(groups: BoardGroup[], filter: BoardFilter): TaskWithFeature[] {
  const rows: TaskWithFeature[] = [];
  for (const { feature, tasks } of groups) {
    for (const task of tasks) {
      if (task.status === "verified" && filter.status !== "verified") continue;
      if (matchesTask(task, feature, filter)) rows.push({ task, feature });
    }
  }
  return rows.sort(
    (a, b) =>
      (a.task.deadline ?? Number.MAX_SAFE_INTEGER) - (b.task.deadline ?? Number.MAX_SAFE_INTEGER)
  );
}

/** The people with work on these tasks, each once, in the order they first appear. */
export function ownersOf(tasks: readonly TaskView[]): UserSummary[] {
  const seen = new Map<string, UserSummary>();
  for (const task of tasks) {
    if (task.status === "proposed" || task.status === "declined") continue;
    if (task.owner !== null && !seen.has(task.owner._id)) seen.set(task.owner._id, task.owner);
  }
  return [...seen.values()];
}
