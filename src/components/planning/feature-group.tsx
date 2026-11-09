import { useRouter } from "expo-router";
import { Typography } from "heroui-native";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

import type { FeatureSummary, TaskView } from "@convex/lib/views";

import { FeatureStatusChip } from "./badges";
import { DeadlineText } from "./deadline-text";
import { TaskCard } from "./task-card";

/** A feature heading on the board, followed by its tasks. The heading opens the feature. */
export function FeatureGroup({
  feature,
  tasks,
}: {
  feature: FeatureSummary;
  tasks: TaskView[];
}): JSX.Element {
  const router = useRouter();

  return (
    <View className="gap-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Feature ${feature.title}`}
        onPress={() =>
          router.push({ pathname: "/features/[featureId]", params: { featureId: feature._id } })
        }
        className="gap-1 active:opacity-70"
      >
        <View className="flex-row items-center justify-between gap-3">
          <Typography type="h6" className="flex-1" numberOfLines={2}>
            {feature.title} ›
          </Typography>
          <FeatureStatusChip status={feature.status} />
        </View>
        <View className="flex-row items-center gap-3">
          <DeadlineText deadline={feature.deadline} prefix="Deadline" />
          <Typography type="body-xs" color="muted">
            {tasks.length === 1 ? "1 task" : `${tasks.length} tasks`}
          </Typography>
        </View>
      </Pressable>
      {tasks.length === 0 ? (
        <Typography type="body-sm" color="muted">
          No tasks yet.
        </Typography>
      ) : (
        tasks.map((task) => <TaskCard key={task._id} task={task} />)
      )}
    </View>
  );
}
