/**
 * Constants shared by Convex functions and the app. Keep this file free of
 * server-only imports so the app can import it.
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Daily logs (Phase 5): how long each part may be, and how many tasks one log links. A weekday
 * log has the four parts; a weekend log is one optional line.
 */
export const DAILY_LOG_LIMITS = {
  done: 2000,
  next: 1000,
  blockers: 1000,
  weekendLine: 280,
  taskIds: 20,
  /** Edits per log (each is an activity entry): far more than a person needs in a day. */
  edits: 50,
} as const;

/** Peer review and verification (Phase 6): a request's or decision's note, and a proof link. */
export const REVIEW_LIMITS = { note: 1000, url: 500 } as const;

/** How long an invite (and its code) stays usable. */
export const INVITE_DAYS = 14;

/**
 * The one message for every failed sign-up: no invite, wrong or expired code, or an existing
 * account. Using a single message means sign-up never reveals who is invited or registered.
 */
export const INVITE_REJECTED_MESSAGE =
  "We couldn't create your account. Check your email and invite code, or ask an admin for a new code.";
