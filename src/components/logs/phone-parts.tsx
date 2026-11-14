import type { JSX } from "react";
import { Pressable, Text, View } from "react-native";

import { Avatar, pastelFor } from "@/components/people/avatar";
import { colors, fonts, STATUS_COLORS, usePageColors } from "@/components/ui/theme";
import { TASK_STATUS_LABELS } from "@/constants/labels";

import {
  dayParts,
  excerpt,
  MARK_WORDS,
  spokenDay,
  type DayMark,
  type DayPerson,
  type LogView,
} from "./log-days";
import { MARK_COLORS } from "./mark-colors";

/**
 * A log's words: what they did, what's next and what's in the way, then the tasks it was about
 * (status-coloured pills; tap one to open it). `ink`/`muted` let it sit on a pastel sticker or on
 * the theme's panel.
 */
export function LogBody({
  log,
  s,
  ink,
  muted,
  onOpenTask,
}: {
  log: LogView;
  s: number;
  ink: string;
  muted: string;
  onOpenTask?: (taskId: string) => void;
}): JSX.Element {
  const part = (label: string, text: string | undefined, warn = false) =>
    text === undefined || text === "" ? null : (
      <View style={{ gap: 3 * s }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 * s }}>
          {/* What's in the way gets a red dot; the words stay in ink so they read on any card. */}
          {warn ? (
            <View
              style={{
                width: 7 * s,
                height: 7 * s,
                borderRadius: 999,
                backgroundColor: colors.red,
              }}
            />
          ) : null}
          <Text
            maxFontSizeMultiplier={1.3}
            style={{
              fontFamily: fonts.bold,
              fontSize: 11 * s,
              letterSpacing: 0.6,
              textTransform: "uppercase",
              color: warn ? ink : muted,
            }}
          >
            {label}
          </Text>
        </View>
        <Text
          style={{ fontFamily: fonts.medium, fontSize: 15 * s, lineHeight: 21 * s, color: ink }}
        >
          {text}
        </Text>
      </View>
    );
  return (
    <View style={{ gap: 12 * s }}>
      {log.isWeekend ? (
        <Text
          style={{ fontFamily: fonts.medium, fontSize: 15 * s, lineHeight: 21 * s, color: ink }}
        >
          {log.done}
        </Text>
      ) : (
        <>
          {part("Did", log.done)}
          {part("Next", log.next)}
          {part("Blocked by", log.blockers, true)}
        </>
      )}
      {log.tasks.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 * s }}>
          {log.tasks.map((task) => {
            const tone = STATUS_COLORS[task.status];
            return (
              <Pressable
                key={task._id}
                accessibilityRole={onOpenTask ? "link" : undefined}
                accessibilityLabel={`${task.title}, ${TASK_STATUS_LABELS[task.status]}`}
                disabled={onOpenTask === undefined}
                onPress={() => onOpenTask?.(task._id)}
                className="active:opacity-70"
                style={{
                  maxWidth: "100%",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6 * s,
                  borderRadius: 999,
                  paddingHorizontal: 10 * s,
                  paddingVertical: 5 * s,
                  backgroundColor: colors.tagFill,
                  borderWidth: 1,
                  borderColor: colors.ink,
                }}
              >
                <View
                  style={{
                    width: 8 * s,
                    height: 8 * s,
                    borderRadius: 999,
                    backgroundColor: tone.fill,
                  }}
                />
                <Text
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.3}
                  style={{
                    flexShrink: 1,
                    fontFamily: fonts.semibold,
                    fontSize: 12 * s,
                    color: colors.ink,
                  }}
                >
                  {task.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

/**
 * A week as seven pills (Monday first), each marked: logged (green), missed (rose), today still
 * open (a lavender ring and a dot), or nothing yet. Tapping a day picks it, when `onPick` is set.
 */
export function WeekPills({
  s,
  width,
  week,
  today,
  marks,
  picked,
  onPick,
}: {
  s: number;
  width: number;
  week: string[];
  today: string;
  marks: DayMark[];
  picked?: string;
  onPick?: (date: string) => void;
}): JSX.Element {
  const gap = 6;
  const pill = (width - gap * 6) / 7;
  return (
    <View style={{ flexDirection: "row", gap }}>
      {week.map((date, i) => {
        const mark = marks[i];
        const tone = MARK_COLORS[mark];
        const { day, letter } = dayParts(date);
        const isToday = date === today;
        const isPicked = picked === date;
        const pickable = onPick !== undefined && date <= today;
        return (
          <Pressable
            key={date}
            // Only days that can be picked (not still to come) are buttons for screen readers.
            accessibilityRole={pickable ? "button" : undefined}
            accessibilityLabel={`${spokenDay(date)}${isToday ? ", today" : ""}: ${MARK_WORDS[mark]}`}
            accessibilityState={pickable ? { selected: isPicked } : undefined}
            disabled={!pickable}
            onPress={() => onPick?.(date)}
            className="active:opacity-70"
            style={{
              width: pill,
              height: pill * 1.75,
              borderRadius: pill / 2,
              borderWidth: isPicked ? 2.5 : 1.5,
              borderColor: isPicked ? colors.ink : tone.border,
              backgroundColor: tone.fill,
              alignItems: "center",
              justifyContent: "center",
              gap: 2 * s,
              opacity: mark === "future" ? 0.45 : 1,
            }}
          >
            <Text
              allowFontScaling={false}
              style={{ fontFamily: fonts.semibold, fontSize: 12 * s, color: tone.ink }}
            >
              {letter}
            </Text>
            <Text
              allowFontScaling={false}
              style={{ fontFamily: fonts.extraBold, fontSize: 17 * s, color: colors.ink }}
            >
              {day}
            </Text>
            <View
              style={{
                width: 5 * s,
                height: 5 * s,
                borderRadius: 999,
                backgroundColor: isToday ? colors.ink : "transparent",
              }}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

/** A small sticker saying how a day went ("Logged", "Missed", "Not yet"). */
export function MarkPill({ mark, s }: { mark: DayMark; s: number }): JSX.Element {
  const tone = MARK_COLORS[mark];
  return (
    <View
      style={{
        borderRadius: 999,
        paddingHorizontal: 10 * s,
        paddingVertical: 4 * s,
        backgroundColor: tone.fill,
        borderWidth: 1,
        borderColor: tone.border,
      }}
    >
      <Text
        maxFontSizeMultiplier={1.3}
        style={{ fontFamily: fonts.bold, fontSize: 11 * s, color: colors.ink }}
      >
        {MARK_WORDS[mark]}
      </Text>
    </View>
  );
}

/** One person on a day: their avatar, name, how the day went, and the start of their log. */
export function PersonDayRow({
  person,
  mark,
  isYou,
  s,
  onPress,
}: {
  person: DayPerson;
  mark: DayMark;
  isYou: boolean;
  s: number;
  onPress: () => void;
}): JSX.Element {
  const c = usePageColors();
  const { user, log } = person;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${user.name}${isYou ? " (you)" : ""}, ${MARK_WORDS[mark]}${
        log ? `: ${excerpt(log.done)}` : ""
      }`}
      accessibilityHint="Opens their logs"
      onPress={onPress}
      className="active:opacity-70"
      style={{
        flexDirection: "row",
        gap: 12 * s,
        borderRadius: 22 * s,
        borderWidth: 1,
        borderColor: c.hairline,
        backgroundColor: c.panel,
        padding: 14 * s,
      }}
    >
      <Avatar size={42 * s} fill={pastelFor(user._id)} name={user.name} dim={!user.isActive} />
      <View style={{ flex: 1, gap: 4 * s }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 * s }}>
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
              style={{ fontFamily: fonts.extraBold, fontSize: 15 * s, color: c.text }}
            >
              {user.name}
            </Text>
            {/* "you" on the shorter title line, so a long name can't push it out of sight. */}
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
              style={{ fontFamily: fonts.medium, fontSize: 12 * s, color: c.muted }}
            >
              {isYou ? `${user.title} · you` : user.title}
            </Text>
          </View>
          <MarkPill mark={mark} s={s} />
        </View>
        {log ? (
          <Text
            numberOfLines={2}
            style={{
              fontFamily: fonts.medium,
              fontSize: 14 * s,
              lineHeight: 19 * s,
              color: c.text,
            }}
          >
            {excerpt(log.done)}
          </Text>
        ) : null}
        {log?.blockers ? (
          <Text
            numberOfLines={1}
            style={{ fontFamily: fonts.semibold, fontSize: 12 * s, color: c.danger }}
          >
            Blocked: {excerpt(log.blockers, 80)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
