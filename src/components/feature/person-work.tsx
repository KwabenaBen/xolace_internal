import { formatDeadline } from "@convex/lib/dates";
import type { TaskView } from "@convex/lib/views";
import type { JSX } from "react";
import { Pressable, Text, View } from "react-native";

import { isOverdue, plural } from "@/components/board/board-stats";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusPill } from "@/components/ui/task-row";
import { CriteriaList } from "@/components/task/criteria-list";
import { colors, fonts, usePageColors } from "@/components/ui/theme";
import { TASK_KIND_LABELS, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/constants/labels";

import type { TeamMember } from "./feature-team";

function Stat({ s, value, label }: { s: number; value: string; label: string }): JSX.Element {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text
        maxFontSizeMultiplier={1.3}
        style={{
          fontFamily: fonts.black,
          fontSize: 28 * s,
          letterSpacing: -1,
          color: colors.ink,
        }}
      >
        {value}
      </Text>
      <Text
        maxFontSizeMultiplier={1.3}
        style={{
          fontFamily: fonts.bold,
          fontSize: 11 * s,
          letterSpacing: 0.8,
          color: "rgba(17,17,17,0.78)",
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
      <ProgressBar
        percent={progress.percent}
        height={8 * s}
        track={"rgba(17,17,17,0.14)"}
        fill={colors.ink}
      />
      {reviews.length > 0 ? (
        <Text
          maxFontSizeMultiplier={1.3}
          style={{ fontFamily: fonts.semibold, fontSize: 13 * s, color: "rgba(17,17,17,0.8)" }}
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
  const c = usePageColors();
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
        backgroundColor: c.panel,
        borderWidth: 1,
        borderColor: c.hairline,
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
            color: c.text,
          }}
        >
          {task.title}
        </Text>
        <StatusPill status={task.status} />
      </View>
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: c.muted }}>
        <Text
          style={{
            fontFamily: late ? fonts.bold : fonts.medium,
            color: late ? c.danger : c.muted,
          }}
        >
          {due}
        </Text>
        {` · ${TASK_PRIORITY_LABELS[task.priority]} · ${TASK_KIND_LABELS[task.kind]}`}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <ProgressBar
          style={{ flex: 1 }}
          percent={percent}
          height={6}
          track={c.panelHigh}
          fill={verified ? colors.green : colors.lavender}
        />
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: c.text }}>{percent}%</Text>
      </View>
      {task.acceptanceCriteria.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text
            style={{
              fontFamily: fonts.bold,
              fontSize: 11,
              letterSpacing: 0.8,
              color: c.muted,
            }}
          >
            TO DELIVER
          </Text>
          <CriteriaList criteria={task.acceptanceCriteria} verified={verified} size="small" />
        </View>
      ) : null}
    </Pressable>
  );
}
