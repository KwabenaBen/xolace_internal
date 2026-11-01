import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { logActivity } from "./activity";
import { appError } from "./errors";
import type { SettingKey, SettingValue, UserRef } from "./validators";

/**
 * Team rules that must not be hard-coded (docs/REQUIREMENTS.md → "Built to grow").
 * To add a setting: add its key to `settingKeyValidator` in ./validators.ts, then describe it here.
 * The seed writes every default; admins change values with `settings.set`.
 */
type SettingKind = "userRef" | "time" | "timeZone" | "nonNegativeNumber";

type SettingDefinition = {
  kind: SettingKind;
  label: string;
  description: string;
  defaultValue: SettingValue;
};

export const SETTINGS: Record<SettingKey, SettingDefinition> = {
  adminTaskReviewer: {
    kind: "userRef",
    label: "Admin task reviewer",
    description: "Verifies tasks owned by an admin, so nobody approves their own work.",
    defaultValue: null,
  },
  morningDigestTime: {
    kind: "time",
    label: "Morning digest time",
    description: "When the daily digest push goes out (HH:mm, team time zone).",
    defaultValue: "08:00",
  },
  dailyLogReminderTime: {
    kind: "time",
    label: "Daily log reminder time",
    description: "Weekday reminder for anyone whose log isn't in yet (HH:mm, team time zone).",
    defaultValue: "20:00",
  },
  timeZone: {
    kind: "timeZone",
    label: "Team time zone",
    description: "Used for digests, reminders and daily-log dates. Africa/Accra is GMT.",
    defaultValue: "Africa/Accra",
  },
  extensionLateWindowHours: {
    kind: "nonNegativeNumber",
    label: "Late extension window (hours)",
    description:
      "An approved extension counts as late if it was requested within this many hours of the deadline.",
    defaultValue: 24,
  },
};

export const SETTING_KEYS = Object.keys(SETTINGS) as SettingKey[];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIME_ZONE_PATTERN = /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/;

export function isUserRef(value: SettingValue): value is UserRef {
  return typeof value === "object" && value !== null;
}

/** Throws INVALID_ARGUMENT unless `value` fits the setting's kind. */
export function validateSettingValue(key: SettingKey, value: SettingValue): void {
  const { kind, label } = SETTINGS[key];
  const valid =
    kind === "userRef"
      ? value === null || isUserRef(value)
      : kind === "time"
        ? typeof value === "string" && TIME_PATTERN.test(value)
        : kind === "timeZone"
          ? typeof value === "string" && TIME_ZONE_PATTERN.test(value)
          : typeof value === "number" && Number.isFinite(value) && value >= 0;
  if (!valid) throw appError("INVALID_ARGUMENT", `That isn't a valid value for "${label}".`);
}

export async function getSettingDoc(
  ctx: QueryCtx,
  key: SettingKey
): Promise<Doc<"settings"> | null> {
  return await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
}

/** The stored value, or the registry default when the setting hasn't been written yet. */
export async function getSettingValue(ctx: QueryCtx, key: SettingKey): Promise<SettingValue> {
  const doc = await getSettingDoc(ctx, key);
  return doc === null ? SETTINGS[key].defaultValue : doc.value;
}

/** Resolves a user-valued setting (e.g. "adminTaskReviewer") to that user, if they've signed up. */
export async function getUserSetting(ctx: QueryCtx, key: SettingKey): Promise<Doc<"users"> | null> {
  const value = await getSettingValue(ctx, key);
  if (!isUserRef(value)) return null;
  if (value.userId !== undefined) return await ctx.db.get("users", value.userId);
  return await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", value.email))
    .unique();
}

/** Inserts or updates a setting and records the change. Validate the value first. */
export async function writeSetting(
  ctx: MutationCtx,
  key: SettingKey,
  value: SettingValue,
  actorId?: Id<"users">
): Promise<void> {
  const existing = await getSettingDoc(ctx, key);
  const before = existing?.value;
  if (existing === null) {
    await ctx.db.insert("settings", { key, value, updatedBy: actorId, updatedAt: Date.now() });
  } else {
    await ctx.db.patch("settings", existing._id, {
      value,
      updatedBy: actorId,
      updatedAt: Date.now(),
    });
  }
  await logActivity(ctx, {
    actorId,
    entityType: "setting",
    entityId: key,
    action: existing === null ? "setting.created" : "setting.updated",
    before,
    after: value,
  });
}

/**
 * Called when someone signs up: any user-valued setting that named them by email
 * (before they had an account) now also stores their user id.
 */
export async function linkPendingUserRefs(
  ctx: MutationCtx,
  user: { _id: Id<"users">; email: string }
): Promise<void> {
  const allSettings = await ctx.db.query("settings").take(200);
  for (const setting of allSettings) {
    const { value } = setting;
    if (isUserRef(value) && value.email === user.email && value.userId === undefined) {
      await ctx.db.patch("settings", setting._id, { value: { ...value, userId: user._id } });
    }
  }
}
