import type { JSX } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";

type PillButtonProps = {
  label: string;
  onPress: () => void;
  /** "light": white pill (primary). "dark": grey pill (secondary). */
  variant?: "light" | "dark";
  isDisabled?: boolean;
  isLoading?: boolean;
};

/** Full-width rounded button for the black sign-in screens. */
export function PillButton({
  label,
  onPress,
  variant = "light",
  isDisabled = false,
  isLoading = false,
}: PillButtonProps): JSX.Element {
  const isLight = variant === "light";
  const disabled = isDisabled || isLoading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: isLoading }}
      disabled={disabled}
      onPress={onPress}
      className={`h-14 w-full flex-row items-center justify-center gap-2 rounded-full px-6 active:opacity-80 disabled:opacity-50 ${
        isLight ? "bg-white" : "bg-neutral-800"
      }`}
    >
      {isLoading ? <ActivityIndicator color={isLight ? "#000000" : "#ffffff"} /> : null}
      <Text className={`text-base font-semibold ${isLight ? "text-black" : "text-white"}`}>
        {label}
      </Text>
    </Pressable>
  );
}
