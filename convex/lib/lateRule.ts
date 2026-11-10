/**
 * The late rule for deadline extensions (docs/REQUIREMENTS.md → "Deadline extensions"). Shared by
 * the server, which applies it when an extension is approved, and the app, which says up front
 * whether a request would count as late. Keep it free of server-only imports.
 *
 * An approved extension counts as late if its type is "other", or if it was asked for less than
 * the team's late window (Team rules, 24 hours by default) before the deadline it extends,
 * including after that deadline has passed. A scope change asked for earlier keeps the task on
 * time. Once a task has a late extension it stays late.
 *
 * Direct moves: an admin moving a started task's deadline later (Edit task) says why, scope
 * change or other, and the same rule applies, so a deadline can't be moved round it. Moving it
 * earlier, or while planning a task that hasn't started, isn't judged. An admin's own task moves
 * only through a request for more time (convex/tasks.ts → update).
 */

const HOUR_MS = 60 * 60 * 1000;

export type ExtensionKind = "scope_change" | "other";

export function isLateExtension({
  type,
  requestedAt,
  currentDeadline,
  windowHours,
}: {
  type: ExtensionKind;
  /** When the extension was (or would be) asked for. */
  requestedAt: number;
  /** The deadline it extends, as it stood when asked for. */
  currentDeadline: number;
  /** Team rules' late window. */
  windowHours: number;
}): boolean {
  if (type === "other") return true;
  return requestedAt > currentDeadline - windowHours * HOUR_MS;
}
