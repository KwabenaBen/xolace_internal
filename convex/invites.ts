import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { findUnusedInvite, findUserByEmail, isValidEmail, normalizeEmail } from "./lib/accounts";
import { logActivity } from "./lib/activity";
import { requireAdmin } from "./lib/auth";
import { appError } from "./lib/errors";
import { roleValidator } from "./lib/validators";
import schema from "./schema";

/** Admin: every invite, newest first. */
export const list = query({
  args: {},
  returns: v.array(schema.doc("invites")),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("invites").order("desc").take(200);
  },
});

/** Admin: invite an email to sign up with the given role and title. */
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

    const inviteId = await ctx.db.insert("invites", {
      email,
      role: args.role,
      title,
      invitedBy: admin._id,
    });
    await logActivity(ctx, {
      actorId: admin._id,
      entityType: "invite",
      entityId: inviteId,
      action: "invite.created",
      after: { email, role: args.role, title },
    });
    return inviteId;
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
