import type { JSX } from "react";
import { Pressable, Text, View } from "react-native";

import { formatDeadline } from "@convex/lib/dates";

import { FeatureStatusPill, TaskRow } from "@/components/ui/task-row";
import { fonts, usePageColors } from "@/components/ui/theme";
import { FEATURE_STATUS_LABELS } from "@/constants/labels";

import { radius } from "./board-theme";
import { plural, type BoardGroup } from "./board-stats";

/** The features and their tasks, below the bento: panels in the theme with sticker-coloured status pills. */
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
  const c = usePageColors();
  if (groups.length === 0) {
    return (
      <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: c.muted }}>{emptyMessage}</Text>
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {groups.map(({ feature, tasks }) => {
        return (
          <View
            key={feature._id}
            style={{
              borderRadius: radius.card,
              borderCurve: "continuous",
              backgroundColor: c.panel,
              borderWidth: 1,
              borderColor: c.hairline,
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
                    color: c.text,
                  }}
                >
                  {feature.title} ›
                </Text>
                <FeatureStatusPill status={feature.status} />
              </View>
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: c.muted }}>
                Deadline {formatDeadline(feature.deadline, now)} · {plural(tasks.length, "task")}
              </Text>
            </Pressable>
            {tasks.length === 0 ? (
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 13,
                  color: c.muted,
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
