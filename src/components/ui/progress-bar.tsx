import type { JSX } from "react";
import { View, type ViewStyle } from "react-native";

/** 0–100, rounded and clamped. */
export function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** A rounded bar filled `percent` of its width. Colours are passed in (theme or sticker). */
export function ProgressBar({
  percent,
  height,
  track,
  fill,
  style,
}: {
  percent: number;
  height: number;
  track: string;
  fill: string;
  style?: ViewStyle;
}): JSX.Element {
  return (
    <View
      style={[{ height, borderRadius: 999, backgroundColor: track, overflow: "hidden" }, style]}
    >
      <View
        style={{
          width: `${clampPercent(percent)}%`,
          height: "100%",
          borderRadius: 999,
          backgroundColor: fill,
        }}
      />
    </View>
  );
}
