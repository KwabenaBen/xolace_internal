import { Ionicons } from "@expo/vector-icons";
import { useRef, useState, type ComponentRef, type JSX } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { calendarDaysBetween, formatDeadline, relativeDay } from "@convex/lib/dates";
import type { TaskView } from "@convex/lib/views";

import { Avatar, pastelFor } from "@/components/people/avatar";
import { clampPercent } from "@/components/ui/progress-bar";
import { StatusPill } from "@/components/ui/task-row";
import { usePageColors } from "@/components/ui/theme";
import { TASK_KIND_LABELS, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/constants/labels";

import { useTweenTo } from "./motion";
import { useHover } from "./use-hover";
import { webType } from "./web-theme";

/** Column widths: the task takes what's left. */
const COLUMNS = { owner: 170, status: 140, progress: 120, due: 100 } as const;

function Row({
  task,
  now,
  onOpen,
}: {
  task: TaskView;
  now: number;
  onOpen: () => void;
}): JSX.Element {
  const c = usePageColors();
  const [hovered, hover] = useHover();
  const [focused, setFocused] = useState(false);
  const active = hovered || focused;
  const wash = useRef<ComponentRef<typeof View>>(null);
  const arrow = useRef<ComponentRef<typeof View>>(null);
  useTweenTo(wash, { opacity: active ? 1 : 0 }, 0.2);
  useTweenTo(arrow, { opacity: active ? 1 : 0, x: active ? 0 : -6 }, 0.22);

  const days = task.deadline === undefined ? null : calendarDaysBetween(now, task.deadline);
  const late = days !== null && days < 0 && task.status !== "verified";
  const due =
    task.status === "verified"
      ? "Verified"
      : task.deadline === undefined
        ? "No deadline"
        : relativeDay(task.deadline, now);
  const percent = task.status === "verified" ? 100 : clampPercent(task.progress);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${task.title}. ${TASK_KIND_LABELS[task.kind]}, ${TASK_PRIORITY_LABELS[task.priority]} priority. ${task.owner?.name ?? "No owner"}, ${TASK_STATUS_LABELS[task.status]}, ${percent}% done, ${task.deadline === undefined ? due : `due ${formatDeadline(task.deadline, now)} (${due})`}`}
      onPress={onOpen}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      {...hover}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <View
        ref={wash}
        style={[StyleSheet.absoluteFill, { opacity: 0, backgroundColor: c.panelRaised }]}
      />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={{ ...webType.body, fontWeight: "600", color: c.text }}>
          {task.title}
        </Text>
        <Text numberOfLines={1} style={{ ...webType.small, color: c.muted }}>
          {TASK_KIND_LABELS[task.kind]} · {TASK_PRIORITY_LABELS[task.priority]}
        </Text>
      </View>
      <View style={{ width: COLUMNS.owner, flexDirection: "row", alignItems: "center", gap: 10 }}>
        {task.owner !== null ? (
          <>
            <Avatar size={28} fill={pastelFor(task.owner._id)} name={task.owner.name} />
            <Text numberOfLines={1} style={{ ...webType.small, flex: 1, color: c.text }}>
              {task.owner.name}
            </Text>
          </>
        ) : (
          <Text style={{ ...webType.small, color: c.muted }}>No owner</Text>
        )}
      </View>
      <View style={{ width: COLUMNS.status }}>
        <StatusPill status={task.status} />
      </View>
      <View style={{ width: COLUMNS.progress, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          style={{
            flex: 1,
            height: 6,
            borderRadius: 999,
            backgroundColor: c.panelHigh,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${percent}%`,
              height: "100%",
              borderRadius: 999,
              backgroundColor: c.text,
            }}
          />
        </View>
        <Text style={{ ...webType.tiny, width: 32, textAlign: "right", color: c.muted }}>
          {percent}%
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={{
          ...webType.small,
          width: COLUMNS.due,
          textAlign: "right",
          fontWeight: late || days === 0 ? "700" : "400",
          color: late ? c.danger : c.text,
        }}
      >
        {due}
      </Text>
      <View ref={arrow} style={{ width: 16, opacity: 0 }}>
        <Ionicons name="arrow-forward" size={15} color={c.text} />
      </View>
    </Pressable>
  );
}

/**
 * The website's task table: the task (and its type and priority), owner, status, progress and
 * when it's due. A row's wash fades in on hover or focus and an arrow slides in; it opens the task.
 */
export function TaskTable({
  tasks,
  now,
  empty,
  onOpenTask,
}: {
  tasks: TaskView[];
  now: number;
  empty: string;
  onOpenTask: (taskId: string) => void;
}): JSX.Element {
  const c = usePageColors();
  if (tasks.length === 0) {
    return (
      <Text style={{ ...webType.body, color: c.muted, paddingHorizontal: 12, paddingVertical: 24 }}>
        {empty}
      </Text>
    );
  }
  const headers: [string, number | undefined][] = [
    ["Task", undefined],
    ["Owner", COLUMNS.owner],
    ["Status", COLUMNS.status],
    ["Progress", COLUMNS.progress],
    ["Due", COLUMNS.due],
  ];
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          gap: 16,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: c.hairline,
          marginBottom: 4,
        }}
      >
        {headers.map(([label, width]) => (
          <Text
            key={label}
            style={{
              ...webType.tiny,
              fontWeight: "600",
              color: c.muted,
              ...(width === undefined ? { flex: 1 } : { width }),
              textAlign: label === "Due" ? "right" : "left",
            }}
          >
            {label}
          </Text>
        ))}
        <View style={{ width: 16 }} />
      </View>
      {tasks.map((task) => (
        <Row key={task._id} task={task} now={now} onOpen={() => onOpenTask(task._id)} />
      ))}
    </View>
  );
}
