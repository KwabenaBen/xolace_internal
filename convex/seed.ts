import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { findUnusedInvite, findUserByEmail, isValidEmail, normalizeEmail } from "./lib/accounts";
import { logActivity } from "./lib/activity";
import { appError } from "./lib/errors";
import { getSettingDoc, SETTING_KEYS, SETTINGS, writeSetting } from "./lib/settings";
import { roleValidator } from "./lib/validators";

/**
 * Seeds invites and default settings. Internal (CLI only) and safe to re-run:
 * existing users, pending invites and stored settings are left alone.
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
    invitesCreated: v.array(v.string()),
    invitesSkipped: v.array(v.string()),
    settingsCreated: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const invitesCreated: string[] = [];
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
      const inviteId = await ctx.db.insert("invites", { email, title, role: invite.role });
      await logActivity(ctx, {
        entityType: "invite",
        entityId: inviteId,
        action: "invite.created",
        after: { email, role: invite.role, title, source: "seed" },
      });
      invitesCreated.push(email);
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
