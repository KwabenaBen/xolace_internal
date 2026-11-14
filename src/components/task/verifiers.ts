import type { Decider } from "@convex/lib/extensions";

/**
 * Who verifies a task, in words. The same people as for requests for more time
 * (convex/lib/extensions.ts → deciderOf): an admin, or for an admin's own task the admin task
 * reviewer from Team rules (the other admins when the reviewer can't). Nobody verifies their own.
 */

/**
 * Why nobody can verify it, or null when someone can. `isMine`: said to the task's owner (when
 * the reviewer owns it, that's the reviewer themself).
 */
function nobodyVerifies(decider: Decider, isMine: boolean): string | null {
  if (decider.kind === "admins") return null;
  if (decider.name === null) {
    return "Nobody can verify an admin's task yet: an admin needs to choose the admin task reviewer in Team rules.";
  }
  if (decider.isOwner) {
    return isMine
      ? "You're the admin task reviewer, so nobody can verify your own task. An admin can choose someone else in Team rules."
      : `Nobody can verify it: ${decider.name} is the admin task reviewer and owns this task. An admin can choose someone else in Team rules.`;
  }
  return null;
}

/**
 * To the task's owner: "An admin verifies it." / "Ama, the admin task reviewer, verifies it." (or
 * why nobody can).
 */
export function verifiedBy(decider: Decider): string {
  if (decider.kind === "admins") return "An admin verifies it.";
  return nobodyVerifies(decider, true) ?? `${decider.name}, the admin task reviewer, verifies it.`;
}

/** "Waiting for an admin to verify it." / "Waiting for Ama, the admin task reviewer, …". */
export function waitingToVerify(decider: Decider): string {
  if (decider.kind === "admins") return "Waiting for an admin to verify it.";
  return (
    nobodyVerifies(decider, false) ??
    `Waiting for ${decider.name}, the admin task reviewer, to verify it.`
  );
}
