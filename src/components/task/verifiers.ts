import type { Decider } from "@convex/lib/extensions";

/**
 * Who verifies a task, in words. The same people as for requests for more time
 * (convex/lib/extensions.ts → deciderOf): an admin, or for an admin's own task the admin task
 * reviewer from Team rules (the other admins when the reviewer can't). Nobody verifies their own.
 */

/** Why nobody can verify it, or null when someone can. */
function nobodyVerifies(decider: Decider): string | null {
  if (decider.kind === "admins") return null;
  if (decider.name === null) {
    return "Nobody can verify an admin's task yet: an admin needs to choose the admin task reviewer in Team rules.";
  }
  if (decider.isOwner) {
    return `Nobody can verify it: ${decider.name} is the admin task reviewer and owns this task. An admin can choose someone else in Team rules.`;
  }
  return null;
}

/** "An admin verifies it." / "Ama, the admin task reviewer, verifies it." */
export function verifiedBy(decider: Decider): string {
  if (decider.kind === "admins") return "An admin verifies it.";
  return nobodyVerifies(decider) ?? `${decider.name}, the admin task reviewer, verifies it.`;
}

/** "Waiting for an admin to verify it." / "Waiting for Ama, the admin task reviewer, …". */
export function waitingToVerify(decider: Decider): string {
  if (decider.kind === "admins") return "Waiting for an admin to verify it.";
  return (
    nobodyVerifies(decider) ?? `Waiting for ${decider.name}, the admin task reviewer, to verify it.`
  );
}
