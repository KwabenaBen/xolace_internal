import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";

type AuthTextFieldProps = Omit<TextInputProps, "style"> & {
  label: string;
  hint?: string;
};

/** Labelled input for the sign-in screens, in the theme's field colours. */
export function AuthTextField({ label, hint, ...inputProps }: AuthTextFieldProps): JSX.Element {
  const [foreground, placeholder] = useThemeColor(["foreground", "field-placeholder"]);
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-muted">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={placeholder}
        selectionColor={foreground}
        cursorColor={foreground}
        className="h-14 rounded-2xl border border-border bg-field px-5 text-base text-field-foreground focus:border-foreground"
        {...inputProps}
      />
      {hint !== undefined ? <Text className="text-xs text-muted">{hint}</Text> : null}
    </View>
  );
}
