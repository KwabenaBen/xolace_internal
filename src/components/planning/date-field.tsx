import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Typography, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { Platform, Pressable, View } from "react-native";

import { formatDeadline } from "@convex/lib/dates";

export type DateFieldProps = {
  label: string;
  /** "YYYY-MM-DD", or "" when no date is chosen yet. */
  value: string;
  onChange: (value: string) => void;
  /** Earliest / latest selectable date, "YYYY-MM-DD". */
  minimumDate?: string;
  maximumDate?: string;
  hint?: string;
};

/** "YYYY-MM-DD" ↔ a local Date at midnight of that calendar day (what the native picker uses). */
function toLocalDate(dateOnly: string): Date {
  const [y, m, d] = dateOnly.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function fromLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
function midday(dateOnly: string): number {
  // Used only to format the label; midday avoids any time-zone edge.
  const [y, m, d] = dateOnly.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 12);
}

/**
 * iOS: the compact system date picker. Android: the system dialog. (Web: date-field.web.tsx.)
 * Before a date is chosen it shows a "Pick a date" button.
 */
export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  hint,
}: DateFieldProps): JSX.Element {
  const accent = useThemeColor("accent");
  const min = minimumDate !== undefined ? toLocalDate(minimumDate) : undefined;
  const max = maximumDate !== undefined ? toLocalDate(maximumDate) : undefined;

  function startingDate(): Date {
    if (value !== "") return toLocalDate(value);
    const today = new Date();
    if (max !== undefined && today > max) return max;
    if (min !== undefined && today < min) return min;
    return today;
  }

  function openAndroid() {
    DateTimePickerAndroid.open({
      value: startingDate(),
      mode: "date",
      minimumDate: min,
      maximumDate: max,
      onValueChange: (_event, date) => onChange(fromLocalDate(date)),
    });
  }

  return (
    <View className="gap-1.5">
      <Typography type="body-sm" weight="medium">
        {label}
      </Typography>
      <View className="min-h-12 flex-row items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2">
        {Platform.OS === "ios" && value !== "" ? (
          <>
            <Typography type="body">{formatDeadline(midday(value))}</Typography>
            <DateTimePicker
              value={toLocalDate(value)}
              mode="date"
              display="compact"
              accentColor={accent}
              minimumDate={min}
              maximumDate={max}
              onValueChange={(_event, date) => onChange(fromLocalDate(date))}
            />
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${value === "" ? "not set" : value}`}
            className="flex-1 py-1 active:opacity-70"
            onPress={() =>
              Platform.OS === "ios" ? onChange(fromLocalDate(startingDate())) : openAndroid()
            }
          >
            <Typography type="body" color={value === "" ? "muted" : "default"}>
              {value === "" ? "Pick a date" : formatDeadline(midday(value))}
            </Typography>
          </Pressable>
        )}
      </View>
      {hint !== undefined ? (
        <Typography type="body-xs" color="muted">
          {hint}
        </Typography>
      ) : null}
    </View>
  );
}
