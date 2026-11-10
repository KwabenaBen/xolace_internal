import type { Decider } from "@convex/lib/extensions";

/**
 * Who decides a task's requests for more time, in words (convex/lib/extensions.ts → deciderOf):
 * the admins, or, on an admin's own task, the admin task reviewer from Team rules. Nobody can when
 * no reviewer is set, or when the reviewer owns the task (nobody decides their own).
 */

/** Why nobody can decide, or null when someone can. `isMine`: said to the task's owner. */
export function nobodyDecides(decider: Decider, isMine: boolean): string | null {
  if (decider.kind === "admins") return null;
  if (decider.name === null) {
    return "Nobody can decide requests for more time on an admin's task yet: an admin needs to choose the admin task reviewer in Team rules.";
  }
  if (decider.isOwner) {
    return isMine
      ? "You're the admin task reviewer, so nobody can decide your requests for more time. An admin can choose someone else in Team rules."
      : `Nobody can decide it: ${decider.name} is the admin task reviewer and owns this task. An admin can choose someone else in Team rules.`;
  }
  return null;
}

/** "An admin decides." / "Ama, the admin task reviewer, decides." */
export function decidedBy(decider: Decider): string {
  if (decider.kind === "admins") return "An admin decides.";
  return nobodyDecides(decider, true) ?? `${decider.name}, the admin task reviewer, decides.`;
}

/** "Waiting for an admin to decide." / "Waiting for Ama, the admin task reviewer, to decide." */
export function waitingFor(decider: Decider): string {
  if (decider.kind === "admins") return "Waiting for an admin to decide.";
  return (
    nobodyDecides(decider, false) ??
    `Waiting for ${decider.name}, the admin task reviewer, to decide.`
  );
}
