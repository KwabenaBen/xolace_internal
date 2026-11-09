import type { Id } from "@convex/_generated/dataModel";
import type { TaskView, UserSummary } from "@convex/lib/views";

import { featureProgress, type FeatureProgress } from "@/components/board/board-stats";

export type TeamMember = {
  user: UserSummary;
  /** The feature's live tasks they own. */
  owns: TaskView[];
  /** The feature's code tasks they peer-review. */
  reviews: TaskView[];
  /** How far their own tasks have got. */
  progress: FeatureProgress;
};

/**
 * Everyone working on a feature: the owners of its live tasks and the peer reviewers on its code
 * tasks. Owners come first (most tasks first), then people who only review.
 */
export function featureTeam(tasks: readonly TaskView[]): TeamMember[] {
  const members = new Map<
    Id<"users">,
    { user: UserSummary; owns: TaskView[]; reviews: TaskView[] }
  >();
  const member = (user: UserSummary) => {
    const existing = members.get(user._id);
    if (existing !== undefined) return existing;
    const created = { user, owns: [] as TaskView[], reviews: [] as TaskView[] };
    members.set(user._id, created);
    return created;
  };

  for (const task of tasks) {
    if (task.status === "proposed" || task.status === "declined") continue;
    if (task.owner !== null) member(task.owner).owns.push(task);
    if (task.peerReviewer !== null) member(task.peerReviewer).reviews.push(task);
  }

  return [...members.values()]
    .map((m) => ({ ...m, progress: featureProgress(m.owns) }))
    .sort(
      (a, b) =>
        b.owns.length - a.owns.length ||
        b.reviews.length - a.reviews.length ||
        a.user.name.localeCompare(b.user.name)
    );
}

/** "Owner", "Peer reviewer" or "Owner · Reviewer". */
export function teamRole(member: TeamMember): string {
  if (member.owns.length > 0 && member.reviews.length > 0) return "Owner · Reviewer";
  return member.owns.length > 0 ? "Owner" : "Peer reviewer";
}
