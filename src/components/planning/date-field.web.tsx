import { Typography, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

import type { DateFieldProps } from "./date-field";

/** Web: the browser's own date input (the native picker has no web version). */
export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  hint,
}: DateFieldProps): JSX.Element {
  const [surface, border, foreground] = useThemeColor(["surface", "border", "foreground"]);

  return (
    <View className="gap-1.5">
      <Typography type="body-sm" weight="medium">
        {label}
      </Typography>
      <input
        type="date"
        aria-label={label}
        value={value}
        min={minimumDate}
        max={maximumDate}
        onChange={(event) => onChange(event.target.value)}
        style={{
          minHeight: 48,
          padding: "0 16px",
          borderRadius: 12,
          border: `1px solid ${border}`,
          background: surface,
          color: foreground,
          font: "inherit",
          fontSize: 16,
          colorScheme: "light dark",
        }}
      />
      {hint !== undefined ? (
        <Typography type="body-xs" color="muted">
          {hint}
        </Typography>
      ) : null}
    </View>
  );
}
