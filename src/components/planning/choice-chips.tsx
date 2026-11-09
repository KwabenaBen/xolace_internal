import { Typography } from "heroui-native";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

/** A small single-choice group shown as pills (task type, priority). */
export function ChoiceChips<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
}): JSX.Element {
  return (
    <View className="gap-1.5">
      <Typography type="body-sm" weight="medium">
        {label}
      </Typography>
      <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              onPress={() => onChange(option.value)}
              className={`rounded-full border px-4 py-2 active:opacity-70 ${
                isSelected ? "border-accent bg-accent" : "border-border bg-surface"
              }`}
            >
              <Typography
                type="body-sm"
                weight="medium"
                className={isSelected ? "text-accent-foreground" : undefined}
              >
                {option.label}
              </Typography>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
