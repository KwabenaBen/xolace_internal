import type { JSX } from "react";
import { Pressable, Text, View } from "react-native";

import { Sym, symbols, type SymbolSpec } from "./sym";
import { fonts, usePageColors } from "./theme";

/** The reference's round header button, in the theme's panel colour. */
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
  const c = usePageColors();
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
        backgroundColor: c.panel,
        borderWidth: 1,
        borderColor: c.hairline,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Sym symbol={symbol} size={18 * s} color={c.text} weight="semibold" />
    </Pressable>
  );
}

/**
 * The top of a detail page: a round back button alone on its row, then the page's subject (a
 * task's or a feature's title) in big type, with an optional grey line under it. With
 * `onSubtitlePress` the grey line is a link (e.g. "Part of <feature> ›" opens the feature).
 */
export function PageHeader({
  s,
  title,
  subtitle,
  onSubtitlePress,
  subtitleHint,
  onBack,
}: {
  s: number;
  title: string;
  subtitle?: string;
  onSubtitlePress?: () => void;
  /** What tapping the subtitle does, for screen readers. */
  subtitleHint?: string;
  onBack: () => void;
}): JSX.Element {
  const c = usePageColors();
  const subtitleStyle = { fontFamily: fonts.medium, fontSize: 14 * s, color: c.muted };
  return (
    <View style={{ gap: 18 * s }}>
      <View style={{ flexDirection: "row" }}>
        <RoundButton symbol={symbols.back} label="Back" onPress={onBack} s={s} />
      </View>
      <View style={{ gap: 6 * s, paddingHorizontal: 2 }}>
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: fonts.black,
            fontSize: 30 * s,
            lineHeight: 34 * s,
            letterSpacing: -1,
            color: c.text,
          }}
        >
          {title}
        </Text>
        {subtitle === undefined ? null : onSubtitlePress !== undefined ? (
          <Pressable
            accessibilityRole="link"
            accessibilityHint={subtitleHint}
            hitSlop={8}
            onPress={onSubtitlePress}
            className="self-start active:opacity-60"
          >
            <Text style={subtitleStyle}>
              {subtitle}
              <Text style={{ fontFamily: fonts.bold, color: c.text }}>{" ›"}</Text>
            </Text>
          </Pressable>
        ) : (
          <Text style={subtitleStyle}>{subtitle}</Text>
        )}
      </View>
    </View>
  );
}
