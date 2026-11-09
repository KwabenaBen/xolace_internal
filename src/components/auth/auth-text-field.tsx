import type { JSX } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";

type AuthTextFieldProps = Omit<TextInputProps, "style"> & {
  label: string;
  hint?: string;
};

/** Labelled input for the black sign-in screens. */
export function AuthTextField({ label, hint, ...inputProps }: AuthTextFieldProps): JSX.Element {
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-neutral-300">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#737373"
        selectionColor="#ffffff"
        cursorColor="#ffffff"
        className="h-14 rounded-2xl border border-neutral-800 bg-neutral-900 px-5 text-base text-white focus:border-neutral-400"
        {...inputProps}
      />
      {hint !== undefined ? <Text className="text-xs text-neutral-500">{hint}</Text> : null}
    </View>
  );
}
