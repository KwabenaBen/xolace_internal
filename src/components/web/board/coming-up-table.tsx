import { Ionicons } from "@expo/vector-icons";
import { useState, type JSX } from "react";
import { Pressable, Text, View } from "react-native";

import { calendarDaysBetween, formatDeadline, relativeDay } from "@convex/lib/dates";

import { Avatar, pastelFor } from "@/components/people/avatar";
import { StatusPill } from "@/components/ui/task-row";
import { fonts, usePageColors } from "@/components/ui/theme";
import { TASK_STATUS_LABELS } from "@/constants/labels";

import { useHover } from "../use-hover";
import { webType } from "../web-theme";

import type { TaskWithFeature } from "./board-filter";

/** Rows shown before "View all". */
const FIRST_ROWS = 6;

/** Column widths: the task takes what's left. */
const COLUMNS = { owner: 170, status: 140, due: 110 } as const;

function Row({
  row,
  now,
  onOpen,
}: {
  row: TaskWithFeature;
  now: number;
  onOpen: () => void;
}): JSX.Element {
  const c = usePageColors();
  const [hovered, hover] = useHover();
  const { task, feature } = row;
  const days = task.deadline === undefined ? null : calendarDaysBetween(now, task.deadline);
  const late = days !== null && days < 0 && task.status !== "verified";
  const due = task.deadline === undefined ? "No deadline" : relativeDay(task.deadline, now);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${task.title}, ${feature.title}. ${task.owner?.name ?? "No owner"}, ${TASK_STATUS_LABELS[task.status]}, ${task.deadline === undefined ? due : `due ${formatDeadline(task.deadline, now)} (${due})`}`}
      onPress={onOpen}
      {...hover}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: hovered ? c.panelRaised : "transparent",
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={{ ...webType.body, fontWeight: "600", color: c.text }}>
          {task.title}
        </Text>
        <Text numberOfLines={1} style={{ ...webType.small, color: c.muted }}>
          {feature.title}
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
    </Pressable>
  );
}

/**
 * The web Board's task table, after the reference's "My next lessons": open tasks by deadline
 * (task and feature, owner, status, when it's due), the first few with "View all" for the rest.
 * A row opens the task.
 */
export function ComingUpTable({
  rows,
  now,
  filtered,
  onOpenTask,
  onClearFilters,
}: {
  rows: TaskWithFeature[];
  now: number;
  filtered: boolean;
  onOpenTask: (taskId: string) => void;
  onClearFilters: () => void;
}): JSX.Element {
  const c = usePageColors();
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? rows : rows.slice(0, FIRST_ROWS);

  return (
    <View
      style={{
        borderRadius: 22,
        borderWidth: 1,
        borderColor: c.hairline,
        backgroundColor: c.panel,
        paddingHorizontal: 12,
        paddingTop: 20,
        paddingBottom: 12,
        gap: 8,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 12,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{ fontFamily: fonts.extraBold, fontSize: 20, letterSpacing: -0.4, color: c.text }}
        >
          Coming up
        </Text>
        {rows.length > FIRST_ROWS ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowAll(!showAll)}
            hitSlop={8}
            style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            className="active:opacity-60"
          >
            <Text
              style={{
                ...webType.small,
                fontWeight: "600",
                color: c.text,
                textDecorationLine: "underline",
              }}
            >
              {showAll ? "Show fewer" : `View all ${rows.length}`}
            </Text>
            <Ionicons name={showAll ? "chevron-up" : "chevron-down"} size={14} color={c.text} />
          </Pressable>
        ) : null}
      </View>

      {rows.length === 0 ? (
        <View style={{ paddingHorizontal: 12, paddingVertical: 28, gap: 10 }}>
          <Text style={{ ...webType.body, color: c.muted }}>
            {filtered ? "No tasks match these filters." : "Nothing open. Every task is verified."}
          </Text>
          {filtered ? (
            <Pressable
              accessibilityRole="button"
              onPress={onClearFilters}
              style={{ alignSelf: "flex-start" }}
              className="active:opacity-60"
            >
              <Text
                style={{
                  ...webType.small,
                  fontWeight: "600",
                  color: c.text,
                  textDecorationLine: "underline",
                }}
              >
                Clear filters
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
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
            {(
              [
                ["Task", undefined],
                ["Owner", COLUMNS.owner],
                ["Status", COLUMNS.status],
                ["Due", COLUMNS.due],
              ] as const
            ).map(([label, width]) => (
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
          </View>
          {shown.map((row) => (
            <Row key={row.task._id} row={row} now={now} onOpen={() => onOpenTask(row.task._id)} />
          ))}
        </View>
      )}
    </View>
  );
}
