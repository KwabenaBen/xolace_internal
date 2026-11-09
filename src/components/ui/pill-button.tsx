import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

type PillButtonProps = {
  label: string;
  onPress: () => void;
  /**
   * "primary": the theme's strongest pill (off-white on black, black on off-white).
   * "secondary": a quiet grey or cream pill.
   */
  variant?: "primary" | "secondary";
  isDisabled?: boolean;
  isLoading?: boolean;
};

/** Full-width rounded button, used on the sign-in screens and the detail pages. */
export function PillButton({
  label,
  onPress,
  variant = "primary",
  isDisabled = false,
  isLoading = false,
}: PillButtonProps): JSX.Element {
  const isPrimary = variant === "primary";
  const disabled = isDisabled || isLoading;
  const spinner = useThemeColor(isPrimary ? "accent-foreground" : "default-foreground");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: isLoading }}
      disabled={disabled}
      onPress={onPress}
      className={`h-14 w-full flex-row items-center justify-center gap-2 rounded-full px-6 active:opacity-80 disabled:opacity-50 ${
        isPrimary ? "bg-accent" : "bg-default"
      }`}
    >
      {isLoading ? <ActivityIndicator color={spinner} /> : null}
      <Text
        className={`text-base font-semibold ${
          isPrimary ? "text-accent-foreground" : "text-default-foreground"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Two pills side by side (or one full width). */
export function PillRow({ children }: { children: JSX.Element[] | JSX.Element }): JSX.Element {
  const items = Array.isArray(children) ? children : [children];
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      {items.map((child, index) => (
        <View key={index} style={{ flex: 1 }}>
          {child}
        </View>
      ))}
    </View>
  );
}
