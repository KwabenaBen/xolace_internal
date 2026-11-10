import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import type { JSX } from "react";
import { Platform, Pressable, Text, View } from "react-native";

import { SheetNoSwipe } from "@/components/ui/sheet";
import { fonts, usePageColors } from "@/components/ui/theme";

import { clock, dateToTime, timeToDate } from "./rules";

export type TimePickerProps = {
  /** "HH:mm". */
  value: string;
  onChange: (value: string) => void;
  /** What the time is for, for screen readers (e.g. "Morning digest time"). */
  label: string;
};

/**
 * A time of day, inside a SaveSheet. iOS: the system time wheel (dragging it never moves the
 * sheet). Android: the time, big, opening the system clock dialog. (Web: time-picker.web.tsx.)
 */
export function TimePicker({ value, onChange, label }: TimePickerProps): JSX.Element {
  const c = usePageColors();

  if (Platform.OS === "ios") {
    return (
      <SheetNoSwipe>
        <View style={{ alignItems: "center" }}>
          <DateTimePicker
            value={timeToDate(value)}
            mode="time"
            display="spinner"
            themeVariant={c.scheme}
            textColor={c.text}
            accessibilityLabel={label}
            onValueChange={(_event, date) => onChange(dateToTime(date))}
          />
        </View>
      </SheetNoSwipe>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${clock(value)}`}
      accessibilityHint="Opens the clock to change it"
      onPress={() =>
        DateTimePickerAndroid.open({
          value: timeToDate(value),
          mode: "time",
          onValueChange: (_event, date) => onChange(dateToTime(date)),
        })
      }
      className="active:opacity-60"
      style={{ alignItems: "center", paddingVertical: 20 }}
    >
      <Text style={{ fontFamily: fonts.black, fontSize: 44, color: c.text }}>{clock(value)}</Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: c.muted }}>Tap to change</Text>
    </Pressable>
  );
}
