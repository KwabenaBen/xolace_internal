import { v } from "convex/values";

import { internalMutation, mutation, query } from "./_generated/server";
import {
  findUnusedInvite,
  findUserByEmail,
  freshInviteCode,
  isValidEmail,
  normalizeEmail,
} from "./lib/accounts";
import { logActivity } from "./lib/activity";
import { requireAdmin } from "./lib/auth";
import { appError } from "./lib/errors";
import { roleValidator } from "./lib/validators";
import schema from "./schema";

/** Admin: every invite, newest first, with the codes of pending ones (admins only). */
export const list = query({
  args: {},
  returns: v.array(schema.doc("invites")),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("invites").order("desc").take(200);
  },
});

/** Admin: invite an email to sign up with the given role and title. Comes with a code. */
export const create = mutation({
  args: { email: v.string(), role: roleValidator, title: v.string() },
  returns: v.id("invites"),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const email = normalizeEmail(args.email);
    const title = args.title.trim();
    if (!isValidEmail(email)) throw appError("INVALID_ARGUMENT", "Enter a valid email address.");
    if (title.length === 0) throw appError("INVALID_ARGUMENT", "Enter a title, e.g. CTO.");
    if ((await findUserByEmail(ctx, email)) !== null) {
      throw appError("CONFLICT", "Someone with this email already has an account.");
    }
    if ((await findUnusedInvite(ctx, email)) !== null) {
      throw appError("CONFLICT", "This email already has a pending invite.");
    }

    const { code, expiresAt } = freshInviteCode(Date.now());
    const inviteId = await ctx.db.insert("invites", {
      email,
      role: args.role,
      title,
      invitedBy: admin._id,
      code,
      expiresAt,
    });
    await logActivity(ctx, {
      actorId: admin._id,
      entityType: "invite",
      entityId: inviteId,
      action: "invite.created",
      after: { email, role: args.role, title, expiresAt },
    });
    return inviteId;
  },
});

/**
 * Admin: a new code for a pending invite, valid for another INVITE_DAYS. The old code stops
 * working. Use it when a code expired, was lost, or the invite predates codes.
 */
export const renew = mutation({
  args: { inviteId: v.id("invites") },
  returns: v.null(),
  handler: async (ctx, { inviteId }) => {
    const admin = await requireAdmin(ctx);
    const invite = await ctx.db.get("invites", inviteId);
    if (invite === null) throw appError("NOT_FOUND", "That invite doesn't exist.");
    if (invite.usedAt !== undefined) {
      throw appError("INVALID_ARGUMENT", "This invite has already been used.");
    }

    const { code, expiresAt } = freshInviteCode(Date.now());
    await ctx.db.patch("invites", inviteId, { code, expiresAt });
    // The code itself is never written to the activity log.
    await logActivity(ctx, {
      actorId: admin._id,
      entityType: "invite",
      entityId: inviteId,
      action: "invite.code_renewed",
      before: { expiresAt: invite.expiresAt ?? null },
      after: { expiresAt },
    });
    return null;
  },
});

/**
 * CLI only: a new code for a pending invite, printed for the person running it. Needed to
 * bootstrap the first admin, who can't see codes in the app before they've joined.
 *
 *   bunx convex run invites:newCode "{email:'coo@example.com'}"
 */
export const newCode = internalMutation({
  args: { email: v.string() },
  returns: v.object({ email: v.string(), code: v.string(), expiresAt: v.number() }),
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    const invite = await findUnusedInvite(ctx, email);
    if (invite === null) throw appError("NOT_FOUND", `No pending invite for ${email}.`);

    const { code, expiresAt } = freshInviteCode(Date.now());
    await ctx.db.patch("invites", invite._id, { code, expiresAt });
    await logActivity(ctx, {
      entityType: "invite",
      entityId: invite._id,
      action: "invite.code_renewed",
      before: { expiresAt: invite.expiresAt ?? null },
      after: { expiresAt, source: "cli" },
    });
    return { email, code, expiresAt };
  },
});

/** Admin: withdraw an invite that hasn't been used yet. */
export const revoke = mutation({
  args: { inviteId: v.id("invites") },
  returns: v.null(),
  handler: async (ctx, { inviteId }) => {
    const admin = await requireAdmin(ctx);
    const invite = await ctx.db.get("invites", inviteId);
    if (invite === null) throw appError("NOT_FOUND", "That invite doesn't exist.");
    if (invite.usedAt !== undefined) {
      throw appError(
        "INVALID_ARGUMENT",
        "This invite has already been used. Deactivate the user instead."
      );
    }

    await ctx.db.delete("invites", inviteId);
    await logActivity(ctx, {
      actorId: admin._id,
      entityType: "invite",
      entityId: inviteId,
      action: "invite.revoked",
      before: { email: invite.email, role: invite.role, title: invite.title },
    });
    return null;
  },
});
