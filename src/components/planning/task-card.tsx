import { useRouter } from "expo-router";
import { Typography } from "heroui-native";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

import type { TaskView } from "@convex/lib/views";

import { TASK_KIND_LABELS } from "@/constants/labels";

import { PriorityText, StatusChip } from "./badges";
import { DeadlineText } from "./deadline-text";

/** A task in a list: title, status, owner, deadline, priority and kind. Opens the task page. */
export function TaskCard({
  task,
  featureTitle,
}: {
  task: TaskView;
  /** Shown when the list isn't already grouped by feature. */
  featureTitle?: string;
}): JSX.Element {
  const router = useRouter();
  const person =
    task.status === "proposed" || task.status === "declined"
      ? `Proposed by ${task.proposer?.name ?? "someone"}`
      : (task.owner?.name ?? "Unassigned");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${task.title}, ${person}`}
      onPress={() => router.push({ pathname: "/tasks/[taskId]", params: { taskId: task._id } })}
      className="gap-2 rounded-2xl border border-border bg-surface p-4 active:opacity-80"
    >
      <View className="flex-row items-start justify-between gap-3">
        <Typography type="body" weight="semibold" className="flex-1" numberOfLines={2}>
          {task.title}
        </Typography>
        <StatusChip status={task.status} />
      </View>
      {featureTitle !== undefined ? (
        <Typography type="body-xs" color="muted" numberOfLines={1}>
          {featureTitle}
        </Typography>
      ) : null}
      <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
        <Typography type="body-xs" color="muted">
          {person}
        </Typography>
        <DeadlineText deadline={task.deadline} status={task.status} />
        <PriorityText priority={task.priority} />
        <Typography type="body-xs" color="muted">
          {TASK_KIND_LABELS[task.kind]}
        </Typography>
      </View>
    </Pressable>
  );
}
