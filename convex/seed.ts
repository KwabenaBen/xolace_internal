import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import {
  findUnusedInvite,
  findUserByEmail,
  freshInviteCode,
  isValidEmail,
  normalizeEmail,
} from "./lib/accounts";
import { logActivity } from "./lib/activity";
import { appError } from "./lib/errors";
import { getSettingDoc, SETTING_KEYS, SETTINGS, writeSetting } from "./lib/settings";
import { roleValidator } from "./lib/validators";

/**
 * Seeds invites and default settings. Internal (CLI only) and safe to re-run:
 * existing users, pending invites and stored settings are left alone. Each new invite gets a
 * one-time code, printed in the result: send each person their code (it isn't stored in any
 * log). Lost or expired codes: `invites:newCode`, or New code on the Admin tab.
 *
 * PowerShell (the CLI reads args as JSON5, so single quotes work):
 *   bunx convex run seed:run "{invites:[{email:'coo@x.com',title:'COO',role:'admin'}], adminTaskReviewerEmail:'ceo@x.com'}"
 * Add --prod to seed production.
 */
export const run = internalMutation({
  args: {
    invites: v.array(v.object({ email: v.string(), title: v.string(), role: roleValidator })),
    // Who verifies tasks owned by an admin. Linked to their user when they sign up.
    adminTaskReviewerEmail: v.optional(v.string()),
  },
  returns: v.object({
    invitesCreated: v.array(v.object({ email: v.string(), code: v.string() })),
    invitesSkipped: v.array(v.string()),
    settingsCreated: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const invitesCreated: { email: string; code: string }[] = [];
    const invitesSkipped: string[] = [];
    const settingsCreated: string[] = [];

    for (const invite of args.invites) {
      const email = normalizeEmail(invite.email);
      const title = invite.title.trim();
      if (!isValidEmail(email))
        throw appError("INVALID_ARGUMENT", `Invalid email: ${invite.email}`);
      if (title.length === 0) throw appError("INVALID_ARGUMENT", `Missing title for ${email}`);
      if (
        (await findUserByEmail(ctx, email)) !== null ||
        (await findUnusedInvite(ctx, email)) !== null
      ) {
        invitesSkipped.push(email);
        continue;
      }
      const { code, expiresAt } = freshInviteCode(Date.now());
      const inviteId = await ctx.db.insert("invites", {
        email,
        title,
        role: invite.role,
        code,
        expiresAt,
      });
      await logActivity(ctx, {
        entityType: "invite",
        entityId: inviteId,
        action: "invite.created",
        after: { email, role: invite.role, title, expiresAt, source: "seed" },
      });
      invitesCreated.push({ email, code });
    }

    for (const key of SETTING_KEYS) {
      if ((await getSettingDoc(ctx, key)) !== null) continue;
      let value = SETTINGS[key].defaultValue;
      if (key === "adminTaskReviewer" && args.adminTaskReviewerEmail !== undefined) {
        const email = normalizeEmail(args.adminTaskReviewerEmail);
        if (!isValidEmail(email)) {
          throw appError("INVALID_ARGUMENT", `Invalid adminTaskReviewerEmail: ${email}`);
        }
        const user = await findUserByEmail(ctx, email);
        value = user === null ? { email } : { email, userId: user._id };
      }
      await writeSetting(ctx, key, value);
      settingsCreated.push(key);
    }

    return { invitesCreated, invitesSkipped, settingsCreated };
  },
});
