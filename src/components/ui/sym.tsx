import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import type { ComponentProps, JSX } from "react";
import { Platform, Text, View, type TextProps } from "react-native";

type SFSymbolName = Extract<SymbolViewProps["name"], string>;
type MaterialName = ComponentProps<typeof MaterialCommunityIcons>["name"];

/** An SF Symbol on iOS and the matching Material icon elsewhere; `fit` evens out their sizes. */
export type SymbolSpec = { ios: SFSymbolName; fallback: MaterialName; fit: number };

export const symbols = {
  dueSoon: { ios: "calendar.badge.clock", fallback: "calendar-clock", fit: 1.1 },
  overdue: { ios: "exclamationmark.triangle.fill", fallback: "alert", fit: 1 },
  waiting: { ios: "tray.full.fill", fallback: "inbox-full", fit: 1.05 },
  nextUp: { ios: "flag.checkered", fallback: "flag-checkered", fit: 1 },
  arrowUpRight: { ios: "arrow.up.right", fallback: "arrow-top-right", fit: 1 },
  progress: { ios: "chart.bar.doc.horizontal.fill", fallback: "chart-box", fit: 1.17 },
  myTasks: { ios: "checklist", fallback: "format-list-checks", fit: 1.15 },
  newFeature: { ios: "plus.rectangle.on.rectangle", fallback: "card-plus-outline", fit: 1.2 },
  propose: { ios: "lightbulb.fill", fallback: "lightbulb-on", fit: 1.1 },
  calendar: { ios: "calendar", fallback: "calendar-month", fit: 1.1 },
  close: { ios: "xmark", fallback: "close", fit: 1 },
  back: { ios: "chevron.left", fallback: "chevron-left", fit: 1 },
  forward: { ios: "chevron.right", fallback: "chevron-right", fit: 1 },
  check: { ios: "checkmark", fallback: "check", fit: 1 },
  send: { ios: "arrow.up", fallback: "arrow-up", fit: 1 },
  system: { ios: "clock.badge.exclamationmark.fill", fallback: "clock-alert", fit: 1.1 },
  add: { ios: "plus", fallback: "plus", fit: 1 },
  invite: { ios: "envelope.fill", fallback: "email", fit: 1.1 },
} as const satisfies Record<string, SymbolSpec>;

/** The icon occupies a `size` square, like SwiftUI's font-sized Image. Decorative: hidden from screen readers. */
export function Sym({
  symbol,
  size,
  color,
  weight,
}: {
  symbol: SymbolSpec;
  size: number;
  color: string;
  weight?: SymbolViewProps["weight"];
}): JSX.Element {
  if (Platform.OS === "ios") {
    return (
      <View
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
      >
        <SymbolView name={symbol.ios} size={size * symbol.fit} tintColor={color} weight={weight} />
      </View>
    );
  }
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      <MaterialCommunityIcons name={symbol.fallback} size={size} color={color} />
    </View>
  );
}

/** Fixed-size text for the bento tiles, which are laid out to exact point sizes (as in the reference). */
export function Txt(props: TextProps): JSX.Element {
  return <Text allowFontScaling={false} {...props} />;
}
