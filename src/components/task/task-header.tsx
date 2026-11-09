import type { JSX } from "react";
import { Pressable, Text, View } from "react-native";

import { fonts } from "@/components/board/board-theme";
import { Sym, type SymbolSpec } from "@/components/board/sym";

import { taskSymbols } from "./task-symbols";
import { taskColors } from "./task-theme";

/** The reference's round header button, in the Board's dark panel colour. */
export function RoundButton({
  symbol,
  label,
  onPress,
  s,
}: {
  symbol: SymbolSpec;
  label: string;
  onPress: () => void;
  s: number;
}): JSX.Element {
  const size = 46 * s;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      className="active:opacity-60"
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        backgroundColor: taskColors.panel,
        borderWidth: 1,
        borderColor: taskColors.hairline,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Sym symbol={symbol} size={18 * s} color={taskColors.white} weight="semibold" />
    </Pressable>
  );
}

/**
 * The top of a black detail page: a round back button alone on its row, then the page's subject
 * (a task's or a feature's title) in big type, with an optional grey line under it.
 */
export function PageHeader({
  s,
  title,
  subtitle,
  onBack,
}: {
  s: number;
  title: string;
  subtitle?: string;
  onBack: () => void;
}): JSX.Element {
  return (
    <View style={{ gap: 18 * s }}>
      <View style={{ flexDirection: "row" }}>
        <RoundButton symbol={taskSymbols.back} label="Back" onPress={onBack} s={s} />
      </View>
      <View style={{ gap: 6 * s, paddingHorizontal: 2 }}>
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: fonts.black,
            fontSize: 30 * s,
            lineHeight: 34 * s,
            letterSpacing: -1,
            color: taskColors.white,
          }}
        >
          {title}
        </Text>
        {subtitle !== undefined ? (
          <Text style={{ fontFamily: fonts.medium, fontSize: 14 * s, color: taskColors.secondary }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
