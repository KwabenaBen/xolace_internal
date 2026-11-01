import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { requireAdmin, requireUser } from "./lib/auth";
import { appError } from "./lib/errors";
import {
  getSettingDoc,
  SETTING_KEYS,
  SETTINGS,
  validateSettingValue,
  writeSetting,
} from "./lib/settings";
import { settingKeyValidator, settingValueValidator } from "./lib/validators";

/** Every team setting with its current value (or default), label and description. */
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      key: settingKeyValidator,
      label: v.string(),
      description: v.string(),
      value: settingValueValidator,
      isDefault: v.boolean(),
      updatedAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx) => {
    await requireUser(ctx);
    const rows = [];
    for (const key of SETTING_KEYS) {
      const doc = await getSettingDoc(ctx, key);
      rows.push({
        key,
        label: SETTINGS[key].label,
        description: SETTINGS[key].description,
        value: doc === null ? SETTINGS[key].defaultValue : doc.value,
        isDefault: doc === null,
        updatedAt: doc?.updatedAt,
      });
    }
    return rows;
  },
});

/**
 * Admin: change a setting. User-valued settings need a `userId` of an active user;
 * the stored email is taken from that user's record.
 */
export const set = mutation({
  args: {
    key: settingKeyValidator,
    value: settingValueValidator,
  },
  returns: v.null(),
  handler: async (ctx, { key, value }) => {
    const admin = await requireAdmin(ctx);
    validateSettingValue(key, value);

    let normalized = value;
    if (SETTINGS[key].kind === "userRef" && value !== null && typeof value === "object") {
      if (value.userId === undefined) {
        throw appError("INVALID_ARGUMENT", "Choose a user for this setting.");
      }
      const user = await ctx.db.get("users", value.userId);
      if (user === null || !user.isActive) {
        throw appError("INVALID_ARGUMENT", "Choose an active user for this setting.");
      }
      normalized = { email: user.email, userId: user._id };
    }

    await writeSetting(ctx, key, normalized, admin._id);
    return null;
  },
});
