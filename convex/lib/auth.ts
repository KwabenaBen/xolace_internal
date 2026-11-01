import { getAuthUserId } from "@convex-dev/auth/server";

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { appError } from "./errors";

/**
 * Permission helpers. Every public query and mutation calls one of these first.
 * They take a QueryCtx, so they work in mutations too.
 */

/** The signed-in user's document, or null when signed out. Does not check `isActive`. */
export async function getCurrentUser(ctx: QueryCtx): Promise<Doc<"users"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return await ctx.db.get("users", userId);
}

/** The signed-in, active user. Throws for signed-out or deactivated users. */
export async function requireUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await getCurrentUser(ctx);
  if (user === null) throw appError("UNAUTHENTICATED", "Please sign in to continue.");
  if (!user.isActive) {
    throw appError("ACCOUNT_INACTIVE", "Your account has been deactivated. Ask an admin for help.");
  }
  return user;
}

export function isAdmin(user: Doc<"users">): boolean {
  return user.role === "admin";
}

/** The signed-in, active admin. Throws for everyone else. */
export async function requireAdmin(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (!isAdmin(user)) throw appError("FORBIDDEN", "Only admins can do this.");
  return user;
}

/** A user who can be given work (owner, peer reviewer, verifier): exists and is active. */
export async function requireAssignableUser(
  ctx: QueryCtx,
  userId: Id<"users">
): Promise<Doc<"users">> {
  const user = await ctx.db.get("users", userId);
  if (user === null) throw appError("NOT_FOUND", "That user doesn't exist.");
  if (!user.isActive) {
    throw appError("INVALID_ARGUMENT", `${user.name} is deactivated and can't be assigned work.`);
  }
  return user;
}

/** Number of active admins; used to stop the last admin from being removed. */
export async function countActiveAdmins(ctx: QueryCtx): Promise<number> {
  const activeUsers = await ctx.db
    .query("users")
    .withIndex("by_isActive", (q) => q.eq("isActive", true))
    .take(500);
  return activeUsers.filter(isAdmin).length;
}
