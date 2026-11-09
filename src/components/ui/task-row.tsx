import type { JSX } from "react";
import { Pressable, Text, View } from "react-native";

import { formatDeadline } from "@convex/lib/dates";
import type { FeatureStatus, TaskStatus } from "@convex/lib/validators";
import type { TaskView } from "@convex/lib/views";

import { isOverdue } from "@/components/board/board-stats";
import {
  FEATURE_STATUS_LABELS,
  TASK_KIND_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/constants/labels";

import { clampPercent, ProgressBar } from "./progress-bar";
import { colors, fonts, STATUS_COLORS, usePageColors } from "./theme";

const FEATURE_COLORS: Record<FeatureStatus, { fill: string; ink: string }> = {
  planned: { fill: colors.cream, ink: colors.black },
  in_progress: { fill: colors.blue, ink: colors.black },
  internal_testing: { fill: colors.yellow, ink: colors.black },
  shipped: { fill: colors.green, ink: colors.black },
};

/** A small coloured sticker pill (same colours in both themes). */
export function Pill({
  label,
  fill,
  ink,
}: {
  label: string;
  fill: string;
  ink: string;
}): JSX.Element {
  return (
    <View
      style={{
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: fill,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: ink }}>{label}</Text>
    </View>
  );
}

export function StatusPill({ status }: { status: TaskStatus }): JSX.Element {
  const { fill, ink } = STATUS_COLORS[status];
  return <Pill label={TASK_STATUS_LABELS[status]} fill={fill} ink={ink} />;
}

export function FeatureStatusPill({ status }: { status: FeatureStatus }): JSX.Element {
  const { fill, ink } = FEATURE_COLORS[status];
  return <Pill label={FEATURE_STATUS_LABELS[status]} fill={fill} ink={ink} />;
}

/**
 * One task in a list, everywhere tasks are listed (Board, tile pages, feature and person pages,
 * My Tasks, Admin): title, status, owner (or who proposed it), deadline, priority, type. Optional:
 * the feature it belongs to (lists not grouped by feature) and its progress bar.
 */
export function TaskRow({
  task,
  now,
  onPress,
  featureTitle,
  showProgress = false,
}: {
  task: TaskView;
  now: number;
  onPress: () => void;
  featureTitle?: string;
  showProgress?: boolean;
}): JSX.Element {
  const c = usePageColors();
  const percent = task.status === "verified" ? 100 : clampPercent(task.progress);
  const live = task.status !== "proposed" && task.status !== "declined";
  const late = isOverdue(task, now);
  const due =
    task.deadline === undefined
      ? "No deadline"
      : late
        ? `Overdue · ${formatDeadline(task.deadline, now)}`
        : `Due ${formatDeadline(task.deadline, now)}`;
  const priorityColor =
    task.priority === "urgent" ? c.danger : task.priority === "high" ? c.text : undefined;
  // A proposal has no owner yet; who suggested it matters more.
  const person = live
    ? (task.owner?.name ?? "Unassigned")
    : `Proposed by ${task.proposer?.name ?? "someone"}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        task.title,
        featureTitle,
        TASK_STATUS_LABELS[task.status],
        person,
        due,
        showProgress && live ? `Progress ${percent} percent` : undefined,
      ]
        .filter((part) => part !== undefined)
        .join(". ")}
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: 18,
        borderCurve: "continuous",
        backgroundColor: c.panelRaised,
        padding: 14,
        gap: 8,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <Text
          numberOfLines={2}
          style={{
            flex: 1,
            fontFamily: fonts.semibold,
            fontSize: 15,
            lineHeight: 20,
            color: c.text,
          }}
        >
          {task.title}
        </Text>
        <StatusPill status={task.status} />
      </View>
      {featureTitle !== undefined ? (
        <Text numberOfLines={1} style={{ fontFamily: fonts.medium, fontSize: 12, color: c.muted }}>
          {featureTitle}
        </Text>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 10, rowGap: 2 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: c.muted }}>{person}</Text>
        <Text
          style={{
            fontFamily: late ? fonts.bold : fonts.medium,
            fontSize: 12,
            color: late ? c.danger : c.muted,
          }}
        >
          {due}
        </Text>
        <Text
          style={{
            fontFamily: priorityColor !== undefined ? fonts.bold : fonts.medium,
            fontSize: 12,
            color: priorityColor ?? c.muted,
          }}
        >
          {TASK_PRIORITY_LABELS[task.priority]}
        </Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: c.muted }}>
          {TASK_KIND_LABELS[task.kind]}
        </Text>
      </View>
      {showProgress && live ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <ProgressBar
            style={{ flex: 1 }}
            percent={percent}
            height={5}
            track={c.panelHigh}
            fill={task.status === "verified" ? colors.green : c.text}
          />
          <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: c.text }}>{percent}%</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
