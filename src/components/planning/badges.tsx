import { Chip, Typography } from "heroui-native";
import type { JSX } from "react";

import type { FeatureStatus, TaskPriority, TaskStatus } from "@convex/lib/validators";

import {
  FEATURE_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/constants/labels";

type ChipColor = "accent" | "default" | "success" | "warning" | "danger";

const STATUS_COLORS: Record<TaskStatus, ChipColor> = {
  proposed: "default",
  declined: "danger",
  todo: "default",
  in_progress: "accent",
  blocked: "danger",
  in_peer_review: "warning",
  submitted: "accent",
  verified: "success",
  changes_requested: "warning",
};

const FEATURE_STATUS_COLORS: Record<FeatureStatus, ChipColor> = {
  planned: "default",
  in_progress: "accent",
  internal_testing: "warning",
  shipped: "success",
};

export function StatusChip({ status }: { status: TaskStatus }): JSX.Element {
  return (
    <Chip size="sm" variant="soft" color={STATUS_COLORS[status]}>
      {TASK_STATUS_LABELS[status]}
    </Chip>
  );
}

export function FeatureStatusChip({ status }: { status: FeatureStatus }): JSX.Element {
  return (
    <Chip size="sm" variant="soft" color={FEATURE_STATUS_COLORS[status]}>
      {FEATURE_STATUS_LABELS[status]}
    </Chip>
  );
}

/** Priority as quiet text; only high and urgent get colour. */
export function PriorityText({ priority }: { priority: TaskPriority }): JSX.Element {
  const className =
    priority === "urgent"
      ? "font-semibold text-danger"
      : priority === "high"
        ? "font-semibold text-warning"
        : undefined;
  return (
    <Typography type="body-xs" color="muted" className={className}>
      {TASK_PRIORITY_LABELS[priority]}
    </Typography>
  );
}
