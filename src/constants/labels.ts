import type {
  ExtensionType,
  FeatureStatus,
  LiveTaskStatus,
  Role,
  TaskKind,
  TaskPriority,
  TaskStatus,
} from "@convex/lib/validators";

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
  declined: "Declined",
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  in_peer_review: "In peer review",
  submitted: "Submitted",
  verified: "Verified",
  changes_requested: "Changes requested",
};

/** Board filter order: the workflow from start to finish. */
export const LIVE_STATUS_ORDER: readonly LiveTaskStatus[] = [
  "todo",
  "in_progress",
  "blocked",
  "changes_requested",
  "in_peer_review",
  "submitted",
  "verified",
];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};
export const PRIORITY_ORDER: readonly TaskPriority[] = ["urgent", "high", "medium", "low"];

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  code: "Code",
  design: "Design",
  content: "Content",
  operations: "Operations",
  other: "Other",
};
export const KIND_ORDER: readonly TaskKind[] = ["code", "design", "content", "operations", "other"];

export const EXTENSION_TYPE_LABELS: Record<ExtensionType, string> = {
  scope_change: "Scope change",
  other: "Other",
};
