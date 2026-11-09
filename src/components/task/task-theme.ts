import type { FeatureStatus, TaskStatus } from "@convex/lib/validators";

/** The word the holo card spells for each status (short, so the condensed type stays big). */
export const STATUS_WORDS: Record<TaskStatus, string> = {
  proposed: "PROPOSED",
  declined: "DECLINED",
  todo: "TO DO",
  in_progress: "IN PROGRESS",
  blocked: "BLOCKED",
  in_peer_review: "IN REVIEW",
  submitted: "SUBMITTED",
  verified: "VERIFIED",
  changes_requested: "CHANGES",
};

/** The word a feature's holo card spells for each stage. */
export const FEATURE_STATUS_WORDS: Record<FeatureStatus, string> = {
  planned: "PLANNED",
  in_progress: "IN PROGRESS",
  internal_testing: "TESTING",
  shipped: "SHIPPED",
};
