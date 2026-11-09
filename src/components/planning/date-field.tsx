import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Typography, useThemeColor } from "heroui-native";
import { useState, type JSX } from "react";
import { Modal, Platform, Pressable, Text, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  /** Shown but not changeable (the hint should say why). */
  isDisabled?: boolean;
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
 * A date picked from the system calendar. iOS: tapping the field opens a sheet with the
 * calendar, and nothing changes until Done (Cancel keeps the old date). Android: the system
 * dialog. (Web: date-field.web.tsx.)
 */
export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  hint,
  isDisabled = false,
}: DateFieldProps): JSX.Element {
  const [accent, surface, foreground] = useThemeColor(["accent", "surface", "foreground"]);
  const scheme = useColorScheme() === "light" ? "light" : "dark";
  const insets = useSafeAreaInsets();
  const min = minimumDate !== undefined ? toLocalDate(minimumDate) : undefined;
  const max = maximumDate !== undefined ? toLocalDate(maximumDate) : undefined;
  const [draft, setDraft] = useState<Date | null>(null);

  function startingDate(): Date {
    if (value !== "") return toLocalDate(value);
    const today = new Date();
    if (max !== undefined && today > max) return max;
    if (min !== undefined && today < min) return min;
    return today;
  }

  function open() {
    if (Platform.OS === "ios") {
      setDraft(startingDate());
      return;
    }
    DateTimePickerAndroid.open({
      value: startingDate(),
      mode: "date",
      minimumDate: min,
      maximumDate: max,
      onValueChange: (_event, date) => onChange(fromLocalDate(date)),
    });
  }

  function done() {
    if (draft !== null) onChange(fromLocalDate(draft));
    setDraft(null);
  }

  return (
    <View className="gap-1.5">
      <Typography type="body-sm" weight="medium">
        {label}
      </Typography>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value === "" ? "not set" : formatDeadline(midday(value))}`}
        accessibilityState={{ disabled: isDisabled }}
        disabled={isDisabled}
        onPress={open}
        className="min-h-12 flex-row items-center rounded-xl border border-border bg-surface px-4 py-2 active:opacity-70 disabled:opacity-60"
      >
        <Typography type="body" color={value === "" ? "muted" : "default"}>
          {value === "" ? "Pick a date" : formatDeadline(midday(value))}
        </Typography>
      </Pressable>
      {hint !== undefined ? (
        <Typography type="body-xs" color="muted">
          {hint}
        </Typography>
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal
          visible={draft !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setDraft(null)}
        >
          <View
            style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" }}
          >
            <View
              style={{
                backgroundColor: surface,
                borderTopLeftRadius: 24,
                borderTopRightRadius: 24,
                paddingBottom: insets.bottom + 8,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingHorizontal: 20,
                  paddingTop: 16,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => setDraft(null)}
                  className="active:opacity-60"
                >
                  <Text style={{ fontSize: 17, color: foreground }}>Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={done}
                  className="active:opacity-60"
                >
                  <Text style={{ fontSize: 17, fontWeight: "600", color: foreground }}>Done</Text>
                </Pressable>
              </View>
              {draft !== null ? (
                <DateTimePicker
                  value={draft}
                  mode="date"
                  display="inline"
                  themeVariant={scheme}
                  accentColor={accent}
                  minimumDate={min}
                  maximumDate={max}
                  onValueChange={(_event, date) => setDraft(date)}
                />
              ) : null}
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
