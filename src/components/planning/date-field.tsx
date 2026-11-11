import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Typography, useThemeColor } from "heroui-native";
import { useState, type JSX } from "react";
import { Keyboard, Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { formatDeadline } from "@convex/lib/dates";

import { Sheet, SheetNoSwipe } from "@/components/ui/sheet";
import { usePageColors } from "@/components/ui/theme";

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
  /**
   * iOS: open the calendar right under the field instead of in a sheet of its own. For a field
   * that's already inside a Sheet (e.g. asking for more time): a sheet opened from a sheet sits
   * badly, worst when the keyboard was up. Only inside a `<Sheet>`. The web ignores it.
   */
  inline?: boolean;
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
  inline = false,
}: DateFieldProps): JSX.Element {
  const [accent, surface, foreground] = useThemeColor(["accent", "surface", "foreground"]);
  const { scheme } = usePageColors();
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
    // The keyboard (e.g. from a note typed above) would otherwise cover or shift the calendar.
    Keyboard.dismiss();
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

      {Platform.OS === "ios" && draft !== null && inline ? (
        <InlineCalendar
          draft={draft}
          scheme={scheme}
          accent={accent}
          foreground={foreground}
          minimumDate={min}
          maximumDate={max}
          onDraft={setDraft}
          onCancel={() => setDraft(null)}
          onDone={() => {
            onChange(fromLocalDate(draft));
            setDraft(null);
          }}
        />
      ) : null}
      {Platform.OS === "ios" && draft !== null && !inline ? (
        <Sheet onClose={() => setDraft(null)} backgroundColor={surface}>
          {({ close }) => (
            <View style={{ paddingBottom: insets.bottom + 8 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingHorizontal: 20,
                  paddingTop: 24,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={close}
                  className="active:opacity-60"
                >
                  <Text style={{ fontSize: 17, color: foreground }}>Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={() => {
                    onChange(fromLocalDate(draft));
                    close();
                  }}
                  className="active:opacity-60"
                >
                  <Text style={{ fontSize: 17, fontWeight: "600", color: foreground }}>Done</Text>
                </Pressable>
              </View>
              <SheetNoSwipe>
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
              </SheetNoSwipe>
            </View>
          )}
        </Sheet>
      ) : null}
    </View>
  );
}

/** The calendar opened in place under the field (`inline`), with Cancel and Done above it. */
function InlineCalendar({
  draft,
  scheme,
  accent,
  foreground,
  minimumDate,
  maximumDate,
  onDraft,
  onCancel,
  onDone,
}: {
  draft: Date;
  scheme: "dark" | "light";
  accent: string;
  foreground: string;
  minimumDate?: Date;
  maximumDate?: Date;
  onDraft: (date: Date) => void;
  onCancel: () => void;
  onDone: () => void;
}): JSX.Element {
  return (
    <View className="gap-2 rounded-2xl border border-border bg-surface px-2 pb-2 pt-3">
      <View
        style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10 }}
      >
        <Pressable
          accessibilityRole="button"
          hitSlop={10}
          onPress={onCancel}
          className="active:opacity-60"
        >
          <Text style={{ fontSize: 17, color: foreground }}>Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          hitSlop={10}
          onPress={onDone}
          className="active:opacity-60"
        >
          <Text style={{ fontSize: 17, fontWeight: "600", color: foreground }}>Done</Text>
        </Pressable>
      </View>
      {/* Dragging across the calendar picks dates; it never pulls the card down. */}
      <SheetNoSwipe>
        <DateTimePicker
          value={draft}
          mode="date"
          display="inline"
          themeVariant={scheme}
          accentColor={accent}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onValueChange={(_event, date) => onDraft(date)}
        />
      </SheetNoSwipe>
    </View>
  );
}
