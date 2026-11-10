import type { FeatureSummary, TaskView } from "@convex/lib/views";

import { isDueSoon, isOverdue, type BoardGroup } from "./board-stats";

/** The pages the Board's quick tiles open: /board/<view>. */
export type BoardListView = "due-this-week" | "overdue" | "waiting";

export const BOARD_LISTS: Record<
  BoardListView,
  { title: string; subtitle: string; empty: string }
> = {
  "due-this-week": {
    title: "due this week",
    subtitle: "Unverified tasks due in the next 7 days, by feature.",
    empty: "Nothing is due in the next 7 days.",
  },
  overdue: {
    title: "overdue",
    subtitle: "Unverified tasks past their deadline, by feature.",
    empty: "Nothing is overdue.",
  },
  waiting: {
    title: "waiting",
    subtitle: "Requests for more time and proposals, waiting for a decision.",
    empty: "No proposals are waiting.",
  },
};

export function isBoardListView(value: string | undefined): value is BoardListView {
  return value === "due-this-week" || value === "overdue" || value === "waiting";
}

/** The board's groups narrowed to one quick view's tasks; features with none drop out. */
export function boardGroupsFor(
  view: "due-this-week" | "overdue",
  groups: BoardGroup[],
  now: number
): BoardGroup[] {
  const keep = view === "overdue" ? isOverdue : isDueSoon;
  return groups.flatMap((group) => {
    const tasks = group.tasks.filter((task) => keep(task, now));
    return tasks.length > 0 ? [{ ...group, tasks }] : [];
  });
}

/** Proposals grouped under their features (soonest feature deadline first). */
export function proposalGroups(proposals: TaskView[], features: FeatureSummary[]): BoardGroup[] {
  return [...features]
    .sort((a, b) => a.deadline - b.deadline)
    .map((feature) => ({
      feature,
      tasks: proposals.filter((task) => task.featureId === feature._id),
    }))
    .filter((group) => group.tasks.length > 0);
}
