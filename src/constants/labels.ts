import type { FeatureStatus, Role, TaskPriority, TaskStatus } from "@convex/lib/validators";

// Display labels for stored enum values. `Record<...>` makes TypeScript flag a missing
// label whenever a value is added to convex/lib/validators.ts.

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  member: "Member",
};

export const FEATURE_STATUS_LABELS: Record<FeatureStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  internal_testing: "Internal testing",
  shipped: "Shipped",
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  proposed: "Proposed",
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  in_peer_review: "In peer review",
  submitted: "Submitted",
  verified: "Verified",
  changes_requested: "Changes requested",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};
