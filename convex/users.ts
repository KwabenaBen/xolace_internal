import { v } from "convex/values";

import { internal } from "./_generated/api";

import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { deleteSessionTokens, revokeUserSessions } from "./lib/accounts";
import { logActivity } from "./lib/activity";
import { countActiveAdmins, getCurrentUser, isAdmin, requireAdmin, requireUser } from "./lib/auth";
import { appError } from "./lib/errors";
import { roleValidator } from "./lib/validators";

/**
 * Whether an email already has a password account. Sign-up refuses those before Convex Auth
 * sees them (convex/auth.ts). Internal: never exposed, so it can't be used to probe who's here.
 */
export const emailHasAccount = internalQuery({
  args: { email: v.string() },
  returns: v.boolean(),
  handler: async (ctx, { email }) => {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email)
      )
      .unique();
    return account !== null;
  },
});

/**
 * The rest of a deactivation's sign-out (convex/lib/accounts.ts → revokeUserSessions): leftover
 * refresh tokens of ended sessions, then the remaining sessions from before the deactivation
 * (reactivated meanwhile, their new sessions are left alone).
 */
export const finishSigningOut = internalMutation({
  args: {
    userId: v.id("users"),
    before: v.number(),
    sessionIds: v.array(v.id("authSessions")),
  },
  returns: v.null(),
  handler: async (ctx, { userId, before, sessionIds }) => {
    const leftover: typeof sessionIds = [];
    for (const sessionId of sessionIds) {
      if (!(await deleteSessionTokens(ctx, sessionId))) leftover.push(sessionId);
    }
    if (leftover.length > 0) {
      await ctx.scheduler.runAfter(0, internal.users.finishSigningOut, {
        userId,
        before,
        sessionIds: leftover,
      });
      return null;
    }
    await revokeUserSessions(ctx, userId, before);
    return null;
  },
});

/** What the app sees of a user: no push token or auth internals. */
const publicUserValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  name: v.string(),
  email: v.string(),
  title: v.string(),
  role: roleValidator,
  isActive: v.boolean(),
  timezone: v.string(),
});

function toPublicUser(user: Doc<"users">) {
  return {
    _id: user._id,
    _creationTime: user._creationTime,
    name: user.name,
    email: user.email,
    title: user.title,
    role: user.role,
    isActive: user.isActive,
    timezone: user.timezone,
  };
}

/**
 * The signed-in user, or null when signed out. Deliberately returns deactivated users
 * too (with `isActive: false`) so the app can explain why it is signing them out.
 */
export const me = query({
  args: {},
  returns: v.union(v.null(), publicUserValidator),
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return user === null ? null : toPublicUser(user);
  },
});

/** Everyone on the team, active and deactivated, sorted by name. */
export const list = query({
  args: {},
  returns: v.array(publicUserValidator),
  handler: async (ctx) => {
    await requireUser(ctx);
    const users = await ctx.db.query("users").take(500);
    return users.map(toPublicUser).sort((a, b) => a.name.localeCompare(b.name));
  },
});

/** Admin: activate or deactivate a user. Deactivating signs them out everywhere. */
export const setActive = mutation({
  args: { userId: v.id("users"), isActive: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { userId, isActive }) => {
    const admin = await requireAdmin(ctx);
    const user = await ctx.db.get("users", userId);
    if (user === null) throw appError("NOT_FOUND", "That user doesn't exist.");
    if (user.isActive === isActive) return null;
    if (!isActive) {
      if (user._id === admin._id) {
        throw appError("INVALID_ARGUMENT", "You can't deactivate your own account.");
      }
      if (isAdmin(user) && (await countActiveAdmins(ctx)) <= 1) {
        throw appError("INVALID_ARGUMENT", "Cadence needs at least one active admin.");
      }
    }

    await ctx.db.patch("users", userId, { isActive });
    if (!isActive) await revokeUserSessions(ctx, userId);
    await logActivity(ctx, {
      actorId: admin._id,
      entityType: "user",
      entityId: userId,
      action: isActive ? "user.reactivated" : "user.deactivated",
      before: { isActive: user.isActive },
      after: { isActive },
    });
    return null;
  },
});

/** Admin: make a user an admin or a member. More than one admin is allowed. */
export const setRole = mutation({
  args: { userId: v.id("users"), role: roleValidator },
  returns: v.null(),
  handler: async (ctx, { userId, role }) => {
    const admin = await requireAdmin(ctx);
    const user = await ctx.db.get("users", userId);
    if (user === null) throw appError("NOT_FOUND", "That user doesn't exist.");
    if (user.role === role) return null;
    if (isAdmin(user) && user.isActive && (await countActiveAdmins(ctx)) <= 1) {
      throw appError("INVALID_ARGUMENT", "Cadence needs at least one active admin.");
    }

    await ctx.db.patch("users", userId, { role });
    await logActivity(ctx, {
      actorId: admin._id,
      entityType: "user",
      entityId: userId,
      action: "user.role_changed",
      before: { role: user.role },
      after: { role },
    });
    return null;
  },
});
