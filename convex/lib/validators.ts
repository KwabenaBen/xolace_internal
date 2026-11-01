import { v, type Infer } from "convex/values";

/**
 * Shared validators for enum-like fields. The schema and every function that
 * accepts one of these values import them from here, so a value is defined once.
 * Values are snake_case; the app maps them to display labels (src/constants/labels.ts).
 */

export const roleValidator = v.union(v.literal("admin"), v.literal("member"));
export type Role = Infer<typeof roleValidator>;

export const featureStatusValidator = v.union(
  v.literal("planned"),
  v.literal("in_progress"),
  v.literal("internal_testing"),
  v.literal("shipped")
);
export type FeatureStatus = Infer<typeof featureStatusValidator>;

export const taskStatusValidator = v.union(
  v.literal("proposed"),
  v.literal("todo"),
  v.literal("in_progress"),
  v.literal("blocked"),
  v.literal("in_peer_review"),
  v.literal("submitted"),
  v.literal("verified"),
  v.literal("changes_requested")
);
export type TaskStatus = Infer<typeof taskStatusValidator>;

export const taskPriorityValidator = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
  v.literal("urgent")
);
export type TaskPriority = Infer<typeof taskPriorityValidator>;

export const extensionTypeValidator = v.union(v.literal("scope_change"), v.literal("other"));
export type ExtensionType = Infer<typeof extensionTypeValidator>;

export const extensionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("declined")
);
export type ExtensionStatus = Infer<typeof extensionStatusValidator>;

export const verificationStageValidator = v.union(
  v.literal("peer_review"),
  v.literal("verification")
);
export type VerificationStage = Infer<typeof verificationStageValidator>;

export const verificationDecisionValidator = v.union(
  v.literal("approved"),
  v.literal("changes_requested")
);
export type VerificationDecision = Infer<typeof verificationDecisionValidator>;

export const activityEntityTypeValidator = v.union(
  v.literal("user"),
  v.literal("invite"),
  v.literal("setting"),
  v.literal("feature"),
  v.literal("task"),
  v.literal("extensionRequest"),
  v.literal("verification"),
  v.literal("dailyLog"),
  v.literal("comment")
);
export type ActivityEntityType = Infer<typeof activityEntityTypeValidator>;

/**
 * A setting that points at a user. `email` is always present so a setting can
 * name someone before they sign up; `userId` is filled in when they do.
 */
export const userRefValidator = v.object({
  email: v.string(),
  userId: v.optional(v.id("users")),
});
export type UserRef = Infer<typeof userRefValidator>;

export const settingValueValidator = v.union(
  v.string(),
  v.number(),
  v.boolean(),
  v.null(),
  userRefValidator
);
export type SettingValue = Infer<typeof settingValueValidator>;

export const settingKeyValidator = v.union(
  v.literal("adminTaskReviewer"),
  v.literal("morningDigestTime"),
  v.literal("dailyLogReminderTime"),
  v.literal("timeZone"),
  v.literal("extensionLateWindowHours")
);
export type SettingKey = Infer<typeof settingKeyValidator>;
