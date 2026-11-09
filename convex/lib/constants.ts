/**
 * Constants shared by Convex functions and the app. Keep this file free of
 * server-only imports so the app can import it.
 */
export const MIN_PASSWORD_LENGTH = 8;

/** How long an invite (and its code) stays usable. */
export const INVITE_DAYS = 14;

/**
 * The one message for every failed sign-up: no invite, wrong or expired code, or an existing
 * account. Using a single message means sign-up never reveals who is invited or registered.
 */
export const INVITE_REJECTED_MESSAGE =
  "We couldn't create your account. Check your email and invite code, or ask an admin for a new code.";
