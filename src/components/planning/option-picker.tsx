import { Ionicons } from "@expo/vector-icons";
import { Typography, useThemeColor } from "heroui-native";
import { useState, type JSX } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type PickerOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

type OptionPickerProps<T extends string> = {
  /** Field label, also the sheet's title. */
  label: string;
  value: T | null;
  options: readonly PickerOption<T>[];
  onChange: (value: T | null) => void;
  /** Shown when nothing is chosen. */
  placeholder: string;
  /** Adds a first option that clears the choice (e.g. "Everyone" for a filter). */
  clearLabel?: string;
  /** "field": a form input. "chip": a compact filter pill. */
  variant?: "field" | "chip";
  isDisabled?: boolean;
};

/**
 * A select that opens a list in a modal sheet. Built on React Native's Modal so it behaves
 * the same on iOS and web.
 */
export function OptionPicker<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder,
  clearLabel,
  variant = "field",
  isDisabled = false,
}: OptionPickerProps<T>): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const [accent, accentForeground, muted] = useThemeColor(["accent", "accent-foreground", "muted"]);
  const selected = options.find((o) => o.value === value);

  function choose(next: T | null) {
    onChange(next);
    setIsOpen(false);
  }

  const trigger =
    variant === "chip" ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
        disabled={isDisabled}
        onPress={() => setIsOpen(true)}
        // A chosen filter is a solid pill in the theme's strongest colour; an empty one is quiet.
        className={`flex-row items-center gap-1 rounded-full border px-3 py-1.5 active:opacity-70 ${
          selected ? "border-accent bg-accent" : "border-border bg-surface"
        }`}
      >
        <Typography
          type="body-sm"
          weight="medium"
          numberOfLines={1}
          className={selected ? "text-accent-foreground" : undefined}
        >
          {selected?.label ?? placeholder}
        </Typography>
        <Ionicons name="chevron-down" size={14} color={selected ? accentForeground : muted} />
      </Pressable>
    ) : (
      <View className="gap-1.5">
        <Typography type="body-sm" weight="medium">
          {label}
        </Typography>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
          disabled={isDisabled}
          onPress={() => setIsOpen(true)}
          className="min-h-12 flex-row items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3 active:opacity-70 disabled:opacity-50"
        >
          <Typography
            type="body"
            color={selected ? "default" : "muted"}
            className="flex-1"
            numberOfLines={1}
          >
            {selected?.label ?? placeholder}
          </Typography>
          <Ionicons name="chevron-down" size={16} color={muted} />
        </Pressable>
      </View>
    );

  const rows: { value: T | null; label: string; description?: string }[] = [
    ...(clearLabel !== undefined ? [{ value: null, label: clearLabel }] : []),
    ...options,
  ];

  return (
    <>
      {trigger}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable
          accessibilityLabel="Close"
          onPress={() => setIsOpen(false)}
          className="flex-1 justify-end bg-black/50 sm:items-center sm:justify-center"
        >
          <Pressable
            // Swallow taps inside the sheet so they don't close it.
            onPress={() => undefined}
            className="max-h-[75%] w-full rounded-t-3xl bg-surface sm:max-w-md sm:rounded-3xl"
            style={{ paddingBottom: insets.bottom + 8 }}
          >
            <View className="flex-row items-center justify-between px-5 pb-2 pt-5">
              <Typography type="h6">{label}</Typography>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={12}
                onPress={() => setIsOpen(false)}
              >
                <Ionicons name="close" size={22} color={muted} />
              </Pressable>
            </View>
            <ScrollView contentContainerClassName="px-2 pb-2">
              {rows.map((row) => {
                const isSelected = row.value === value;
                return (
                  <Pressable
                    key={row.value ?? "__clear"}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => choose(row.value)}
                    className="flex-row items-center gap-3 rounded-xl px-3 py-3 active:bg-default"
                  >
                    <View className="flex-1 gap-0.5">
                      <Typography type="body" weight={isSelected ? "semibold" : "normal"}>
                        {row.label}
                      </Typography>
                      {row.description !== undefined ? (
                        <Typography type="body-xs" color="muted">
                          {row.description}
                        </Typography>
                      ) : null}
                    </View>
                    {isSelected ? <Ionicons name="checkmark" size={20} color={accent} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
