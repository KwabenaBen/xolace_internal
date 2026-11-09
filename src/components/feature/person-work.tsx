import { formatDeadline } from "@convex/lib/dates";
import type { TaskView } from "@convex/lib/views";
import type { JSX } from "react";
import { Pressable, Text, View } from "react-native";

import { isOverdue, plural } from "@/components/board/board-stats";
import { colors, fonts } from "@/components/board/board-theme";
import { StatusPill } from "@/components/board/feature-feed";
import { Sym } from "@/components/board/sym";
import { taskSymbols } from "@/components/task/task-symbols";
import { taskColors } from "@/components/task/task-theme";
import { TASK_KIND_LABELS, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/constants/labels";

import type { TeamMember } from "./feature-team";

function Stat({ s, value, label }: { s: number; value: string; label: string }): JSX.Element {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text
        allowFontScaling={false}
        style={{
          fontFamily: fonts.black,
          fontSize: 28 * s,
          letterSpacing: -1,
          color: taskColors.ink,
        }}
      >
        {value}
      </Text>
      <Text
        allowFontScaling={false}
        style={{
          fontFamily: fonts.bold,
          fontSize: 11 * s,
          letterSpacing: 0.8,
          color: "rgba(17,17,17,0.6)",
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/** A person's work on one feature at a glance, on the pastel of their Who's on it card. */
export function PersonSummaryCard({
  s,
  member,
  color,
}: {
  s: number;
  member: TeamMember;
  color: string;
}): JSX.Element {
  const { owns, reviews, progress } = member;
  const spoken = [
    `Owns ${plural(owns.length, "task")}`,
    owns.length > 0 ? `${progress.verified} verified, ${progress.percent} percent done` : null,
    reviews.length > 0 ? `reviews ${plural(reviews.length, "code task")}` : null,
  ]
    .filter((part) => part !== null)
    .join(", ");

  return (
    <View
      accessible
      accessibilityLabel={spoken}
      style={{ borderRadius: 30 * s, backgroundColor: color, padding: 20 * s, gap: 16 * s }}
    >
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Stat s={s} value={String(owns.length)} label="TASKS" />
        <Stat s={s} value={String(progress.verified)} label="VERIFIED" />
        <Stat s={s} value={`${progress.percent}%`} label="PROGRESS" />
      </View>
      <View
        style={{
          height: 8 * s,
          borderRadius: 999,
          backgroundColor: "rgba(17,17,17,0.14)",
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${progress.percent}%`,
            height: "100%",
            borderRadius: 999,
            backgroundColor: taskColors.ink,
          }}
        />
      </View>
      {reviews.length > 0 ? (
        <Text
          allowFontScaling={false}
          style={{ fontFamily: fonts.semibold, fontSize: 13 * s, color: "rgba(17,17,17,0.7)" }}
        >
          Also peer-reviews {plural(reviews.length, "code task")} here
        </Text>
      ) : null}
    </View>
  );
}

/**
 * One of their tasks, in full: status, deadline, progress, and the acceptance criteria they have
 * to deliver (ticked once verified). Tap it to open the task.
 */
export function PersonTaskCard({
  s,
  task,
  now,
  onPress,
}: {
  s: number;
  task: TaskView;
  now: number;
  onPress: () => void;
}): JSX.Element {
  const late = isOverdue(task, now);
  const verified = task.status === "verified";
  const percent = verified ? 100 : Math.max(0, Math.min(100, Math.round(task.progress)));
  const due =
    task.deadline === undefined
      ? "No deadline"
      : `${late ? "Overdue" : "Due"} ${formatDeadline(task.deadline, now)}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${task.title}. ${TASK_STATUS_LABELS[task.status]}. ${due}. Progress ${percent} percent. ${plural(task.acceptanceCriteria.length, "criterion", "criteria")}.`}
      accessibilityHint="Opens the task"
      onPress={onPress}
      className="active:opacity-80"
      style={{
        borderRadius: 24 * s,
        backgroundColor: taskColors.panel,
        borderWidth: 1,
        borderColor: taskColors.hairline,
        padding: 16 * s,
        gap: 12 * s,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <Text
          numberOfLines={2}
          style={{
            flex: 1,
            fontFamily: fonts.extraBold,
            fontSize: 16,
            lineHeight: 21,
            color: taskColors.white,
          }}
        >
          {task.title}
        </Text>
        <StatusPill status={task.status} />
      </View>
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: taskColors.secondary }}>
        <Text
          style={{
            fontFamily: late ? fonts.bold : fonts.medium,
            color: late ? colors.rose : taskColors.secondary,
          }}
        >
          {due}
        </Text>
        {` · ${TASK_PRIORITY_LABELS[task.priority]} · ${TASK_KIND_LABELS[task.kind]}`}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          style={{
            flex: 1,
            height: 6,
            borderRadius: 999,
            backgroundColor: colors.panel12,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${percent}%`,
              height: "100%",
              borderRadius: 999,
              backgroundColor: verified ? colors.green : taskColors.lavender,
            }}
          />
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: taskColors.white }}>
          {percent}%
        </Text>
      </View>
      {task.acceptanceCriteria.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text
            style={{
              fontFamily: fonts.bold,
              fontSize: 11,
              letterSpacing: 0.8,
              color: taskColors.secondary,
            }}
          >
            TO DELIVER
          </Text>
          {task.acceptanceCriteria.map((criterion, index) => (
            <View key={index} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  borderWidth: verified ? 0 : 1.5,
                  borderColor: "rgba(255,255,255,0.3)",
                  backgroundColor: verified ? taskColors.lavender : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 1,
                }}
              >
                {verified ? (
                  <Sym
                    symbol={taskSymbols.approve}
                    size={10}
                    color={taskColors.ink}
                    weight="bold"
                  />
                ) : (
                  <Text style={{ fontFamily: fonts.bold, fontSize: 9, color: taskColors.white }}>
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text
                style={{
                  flex: 1,
                  fontFamily: fonts.medium,
                  fontSize: 14,
                  lineHeight: 19,
                  color: "rgba(255,255,255,0.85)",
                }}
              >
                {criterion}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}
