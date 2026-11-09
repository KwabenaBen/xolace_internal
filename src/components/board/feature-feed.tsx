import type { JSX } from "react";
import { Pressable, Text, View } from "react-native";

import { formatDeadline } from "@convex/lib/dates";
import type { FeatureStatus, TaskStatus } from "@convex/lib/validators";
import type { TaskView } from "@convex/lib/views";

import {
  FEATURE_STATUS_LABELS,
  TASK_KIND_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/constants/labels";

import { colors, fonts, radius, STATUS_COLORS } from "./board-theme";
import { isOverdue, plural, type BoardGroup } from "./board-stats";

const FEATURE_COLORS: Record<FeatureStatus, { fill: string; ink: string }> = {
  planned: { fill: colors.cream, ink: colors.black },
  in_progress: { fill: colors.blue, ink: colors.white },
  internal_testing: { fill: colors.yellow, ink: colors.black },
  shipped: { fill: colors.green, ink: colors.black },
};

function Pill({ label, fill, ink }: { label: string; fill: string; ink: string }): JSX.Element {
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

function TaskRow({
  task,
  now,
  onPress,
}: {
  task: TaskView;
  now: number;
  onPress: () => void;
}): JSX.Element {
  const late = isOverdue(task, now);
  const due =
    task.deadline === undefined
      ? "No deadline"
      : late
        ? `Overdue · ${formatDeadline(task.deadline, now)}`
        : `Due ${formatDeadline(task.deadline, now)}`;
  const priorityColor =
    task.priority === "urgent" ? colors.red : task.priority === "high" ? colors.orange : undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${task.title}. ${TASK_STATUS_LABELS[task.status]}. ${task.owner?.name ?? "Unassigned"}. ${due}.`}
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: radius.row,
        borderCurve: "continuous",
        backgroundColor: colors.panel08,
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
            color: colors.white,
          }}
        >
          {task.title}
        </Text>
        <StatusPill status={task.status} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 10, rowGap: 2 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.secondary }}>
          {task.owner?.name ?? "Unassigned"}
        </Text>
        <Text
          style={{
            fontFamily: late ? fonts.bold : fonts.medium,
            fontSize: 12,
            color: late ? colors.rose : colors.secondary,
          }}
        >
          {due}
        </Text>
        <Text
          style={{
            fontFamily: priorityColor !== undefined ? fonts.bold : fonts.medium,
            fontSize: 12,
            color: priorityColor ?? colors.secondary,
          }}
        >
          {TASK_PRIORITY_LABELS[task.priority]}
        </Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.secondary }}>
          {TASK_KIND_LABELS[task.kind]}
        </Text>
      </View>
    </Pressable>
  );
}

/** The features and their tasks, below the bento: graphite cards with sticker-coloured status pills. */
export function FeatureFeed({
  groups,
  now,
  emptyMessage,
  onOpenFeature,
  onOpenTask,
}: {
  groups: BoardGroup[];
  now: number;
  emptyMessage: string;
  onOpenFeature: (featureId: string) => void;
  onOpenTask: (taskId: string) => void;
}): JSX.Element {
  if (groups.length === 0) {
    return (
      <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.secondary }}>
        {emptyMessage}
      </Text>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {groups.map(({ feature, tasks }) => {
        const { fill, ink } = FEATURE_COLORS[feature.status];
        return (
          <View
            key={feature._id}
            style={{
              borderRadius: radius.card,
              borderCurve: "continuous",
              backgroundColor: colors.statsShade,
              borderWidth: 1,
              borderColor: colors.hairline,
              padding: 14,
              gap: 10,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Feature ${feature.title}, ${FEATURE_STATUS_LABELS[feature.status]}, deadline ${formatDeadline(feature.deadline, now)}, ${plural(tasks.length, "task")}`}
              onPress={() => onOpenFeature(feature._id)}
              style={({ pressed }) => ({
                gap: 6,
                paddingHorizontal: 4,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <Text
                  numberOfLines={2}
                  style={{
                    flex: 1,
                    fontFamily: fonts.extraBold,
                    fontSize: 20,
                    letterSpacing: -0.4,
                    color: colors.white,
                  }}
                >
                  {feature.title} ›
                </Text>
                <Pill label={FEATURE_STATUS_LABELS[feature.status]} fill={fill} ink={ink} />
              </View>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.secondary }}>
                Deadline {formatDeadline(feature.deadline, now)} · {plural(tasks.length, "task")}
              </Text>
            </Pressable>
            {tasks.length === 0 ? (
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 13,
                  color: colors.secondary,
                  paddingHorizontal: 4,
                }}
              >
                No tasks yet.
              </Text>
            ) : (
              tasks.map((task) => (
                <TaskRow
                  key={task._id}
                  task={task}
                  now={now}
                  onPress={() => onOpenTask(task._id)}
                />
              ))
            )}
          </View>
        );
      })}
    </View>
  );
}
