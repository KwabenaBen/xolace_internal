import type { JSX } from "react";
import { View } from "react-native";

import { fonts, usePageColors } from "@/components/ui/theme";

import type { TimePickerProps } from "./time-picker";

/** Web: the browser's own time input, big (the native wheel has no web version). */
export function TimePicker({ value, onChange, label }: TimePickerProps): JSX.Element {
  const c = usePageColors();
  return (
    <View style={{ alignItems: "center", paddingVertical: 16 }}>
      <input
        type="time"
        aria-label={label}
        value={value}
        required
        onChange={(event) => {
          // Cleared or half-typed: keep the last whole time.
          if (/^\d{2}:\d{2}$/.test(event.target.value)) onChange(event.target.value);
        }}
        style={{
          padding: "8px 16px",
          borderRadius: 16,
          border: `1px solid ${c.hairline}`,
          background: c.field,
          color: c.fieldText,
          fontFamily: fonts.black,
          fontSize: 40,
          colorScheme: c.scheme,
        }}
      />
    </View>
  );
}
