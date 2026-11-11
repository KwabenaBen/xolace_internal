import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { logActivity } from "./activity";
import { DAY_MS } from "./dates";
import { INVITE_DAYS, INVITE_REJECTED_MESSAGE } from "./constants";
import { appError } from "./errors";
import { newInviteCode, normalizeInviteCode } from "./inviteCodes";
import { getSettingValue, linkPendingUserRefs, SETTINGS } from "./settings";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Emails are stored trimmed and lower-cased everywhere (users, invites, auth accounts). */
export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email);
}

/** The newest invite for this email that hasn't been used yet, if any. */
export async function findUnusedInvite(
  ctx: QueryCtx,
  email: string
): Promise<Doc<"invites"> | null> {
  const invites = await ctx.db
    .query("invites")
    .withIndex("by_email", (q) => q.eq("email", email))
    .order("desc")
    .take(20);
  return invites.find((invite) => invite.usedAt === undefined) ?? null;
}

export async function findUserByEmail(ctx: QueryCtx, email: string): Promise<Doc<"users"> | null> {
  return await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .unique();
}

/** A new code and expiry for an invite (the code is stored without its dash). */
export function freshInviteCode(now: number): { code: string; expiresAt: number } {
  return { code: newInviteCode(), expiresAt: now + INVITE_DAYS * DAY_MS };
}

/**
 * Sign-up gate, called from Convex Auth's `createOrUpdateUser` callback (convex/auth.ts).
 * Only an email with an unused, unexpired invite AND its code can sign up. Every failure gets
 * the same message, so sign-up never reveals who is invited or registered. The user gets the
 * invite's role and
 * title and the invite is marked used. Runs in the same transaction as the auth account
 * insert, so a rejection leaves nothing behind.
 */
export async function createUserFromInvite(
  ctx: MutationCtx,
  { email, name, inviteCode }: { email: string; name: string; inviteCode: string }
): Promise<Id<"users">> {
  const invite = await findUnusedInvite(ctx, email);
  const code = normalizeInviteCode(inviteCode);
  if (
    invite === null ||
    invite.code === undefined ||
    invite.code !== code ||
    invite.expiresAt === undefined ||
    invite.expiresAt < Date.now() ||
    (await findUserByEmail(ctx, email)) !== null
  ) {
    throw appError("NOT_INVITED", INVITE_REJECTED_MESSAGE);
  }

  const timeZone = await getSettingValue(ctx, "timeZone");
  const userId = await ctx.db.insert("users", {
    name,
    email,
    title: invite.title,
    role: invite.role,
    isActive: true,
    timezone: typeof timeZone === "string" ? timeZone : String(SETTINGS.timeZone.defaultValue),
  });
  // The code has done its job; clear it so it can't be read or reused.
  await ctx.db.patch("invites", invite._id, {
    usedAt: Date.now(),
    usedBy: userId,
    code: undefined,
  });
  await linkPendingUserRefs(ctx, { _id: userId, email });
  await logActivity(ctx, {
    actorId: userId,
    entityType: "user",
    entityId: userId,
    action: "user.signed_up",
    after: { name, email, role: invite.role, title: invite.title, inviteId: invite._id },
  });
  return userId;
}

/** Sign-in gate, called from Convex Auth's `beforeSessionCreation` callback on every sign-in. */
export async function assertUserCanSignIn(ctx: QueryCtx, userId: Id<"users">): Promise<void> {
  const user = await ctx.db.get("users", userId);
  if (user === null || !user.isActive) {
    throw appError(
      "ACCOUNT_INACTIVE",
      "This account has been deactivated. Ask an admin to reactivate it."
    );
  }
}

const SESSION_BATCH = 25;
const TOKEN_BATCH = 100;

/** Deletes up to a batch of a session's refresh tokens; true once none are left. */
export async function deleteSessionTokens(
  ctx: MutationCtx,
  sessionId: Id<"authSessions">
): Promise<boolean> {
  const tokens = await ctx.db
    .query("authRefreshTokens")
    .withIndex("sessionId", (q) => q.eq("sessionId", sessionId))
    .take(TOKEN_BATCH);
  for (const token of tokens) await ctx.db.delete("authRefreshTokens", token._id);
  return tokens.length < TOKEN_BATCH;
}

/**
 * Ends every session a user had when deactivated, so they're signed out everywhere: the newest
 * first (the ones in use), a batch at a time; the rest, and any leftover refresh tokens, in a
 * scheduled follow-up (users.finishSigningOut), so a long history never fails the change. Only
 * sessions from before `before` go, so if they're reactivated meanwhile their new sessions stay
 * (and none of the old ones come back). Deleting a session ends it at once: its tokens can't be
 * refreshed without it.
 */
export async function revokeUserSessions(
  ctx: MutationCtx,
  userId: Id<"users">,
  // +1 ms: a session made in the same millisecond still counts (none can start while they're
  // deactivated: beforeSessionCreation refuses).
  before: number = Date.now() + 1
): Promise<void> {
  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId).lt("_creationTime", before))
    .order("desc")
    .take(SESSION_BATCH);
  const leftoverTokens: Id<"authSessions">[] = [];
  for (const session of sessions) {
    await ctx.db.delete("authSessions", session._id);
    if (!(await deleteSessionTokens(ctx, session._id))) leftoverTokens.push(session._id);
  }
  if (sessions.length === SESSION_BATCH || leftoverTokens.length > 0) {
    await ctx.scheduler.runAfter(0, internal.users.finishSigningOut, {
      userId,
      before,
      sessionIds: leftoverTokens,
    });
  }
}
