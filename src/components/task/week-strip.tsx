import type { JSX } from "react";
import { Text, View } from "react-native";

import { longDay, sameDayGmt, startOfDayGmt } from "@convex/lib/dates";

import { fonts } from "@/components/board/board-theme";

import { weekLabel, weekOf } from "./task-dates";
import { taskColors } from "./task-theme";

const GAP = 6;

/**
 * The deadline's week as the reference's row of day pills: the deadline day filled lavender,
 * today marked with a dot, days already gone dimmed.
 *
 * Not on any page for now: on the task page it only repeated the deadline. Kept for Phase 4
 * (daily logs), where the pills can mark the days someone logged work.
 */
export function WeekStrip({
  width,
  s,
  deadline,
  now,
}: {
  width: number;
  s: number;
  deadline: number;
  now: number;
}): JSX.Element {
  const week = weekOf(deadline);
  const pill = (width - GAP * 6) / 7;
  const todayStart = startOfDayGmt(now);

  return (
    <View
      accessible
      accessibilityLabel={`Deadline ${longDay(deadline)}. Today is ${longDay(now)}.`}
      style={{ gap: 12 * s }}
    >
      <View style={{ flexDirection: "row", alignItems: "baseline", paddingHorizontal: 4 }}>
        <Text
          allowFontScaling={false}
          style={{
            flex: 1,
            fontFamily: fonts.extraBold,
            fontSize: 18 * s,
            color: taskColors.white,
          }}
        >
          Deadline week
        </Text>
        <Text
          allowFontScaling={false}
          style={{ fontFamily: fonts.semibold, fontSize: 13 * s, color: taskColors.secondary }}
        >
          {weekLabel(week)}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: GAP }}>
        {week.map((day) => {
          const isDeadline = sameDayGmt(day.start, deadline);
          const isToday = sameDayGmt(day.start, now);
          const isPast = day.start < todayStart;
          return (
            <View
              key={day.start}
              style={{
                width: pill,
                height: pill * 1.75,
                borderRadius: pill / 2,
                borderWidth: 1.5,
                borderColor: isDeadline ? taskColors.lavenderStrong : taskColors.pillBorder,
                backgroundColor: isDeadline ? taskColors.lavenderStrong : taskColors.pill,
                alignItems: "center",
                justifyContent: "center",
                gap: 2 * s,
                opacity: isPast && !isDeadline ? 0.45 : 1,
              }}
            >
              <Text
                allowFontScaling={false}
                style={{
                  fontFamily: fonts.semibold,
                  fontSize: 12 * s,
                  color: isDeadline ? taskColors.ink : taskColors.note,
                }}
              >
                {day.letter}
              </Text>
              <Text
                allowFontScaling={false}
                style={{ fontFamily: fonts.extraBold, fontSize: 17 * s, color: taskColors.ink }}
              >
                {day.date}
              </Text>
              <View
                style={{
                  width: 5 * s,
                  height: 5 * s,
                  borderRadius: 999,
                  backgroundColor: isToday ? taskColors.ink : "transparent",
                }}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}
