import type { JSX } from "react";
import { Pressable, Text, View } from "react-native";

import { Sym, symbols } from "@/components/ui/sym";
import { fonts, usePageColors } from "@/components/ui/theme";

/**
 * One rule in a Team rules panel: its name and value on a line (with a chevron when it can be
 * changed), what it means under them, and a hairline above every row but the first.
 */
export function RuleRow({
  s,
  label,
  value,
  note,
  isFirst = false,
  onPress,
}: {
  s: number;
  label: string;
  value: string;
  note?: string;
  isFirst?: boolean;
  /** Opens the rule's sheet; leave it out when the reader can't change it. */
  onPress?: () => void;
}): JSX.Element {
  const c = usePageColors();
  return (
    <Pressable
      disabled={onPress === undefined}
      onPress={onPress}
      accessibilityRole={onPress !== undefined ? "button" : undefined}
      accessibilityLabel={`${label}, ${value}`}
      accessibilityHint={note}
      style={({ pressed }) => ({
        gap: 4 * s,
        paddingTop: isFirst ? 2 * s : 14 * s,
        paddingBottom: 12 * s,
        borderTopWidth: isFirst ? 0 : 1,
        borderTopColor: c.hairline,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 * s }}>
        <Text
          maxFontSizeMultiplier={1.4}
          style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 15 * s, color: c.text }}
        >
          {label}
        </Text>
        <Text
          maxFontSizeMultiplier={1.4}
          style={{ fontFamily: fonts.extraBold, fontSize: 15 * s, color: c.text }}
        >
          {value}
        </Text>
        {onPress !== undefined ? (
          <Sym symbol={symbols.forward} size={12 * s} color={c.muted} weight="semibold" />
        ) : null}
      </View>
      {note !== undefined ? (
        <Text
          maxFontSizeMultiplier={1.4}
          style={{ fontFamily: fonts.medium, fontSize: 13 * s, lineHeight: 18 * s, color: c.muted }}
        >
          {note}
        </Text>
      ) : null}
    </Pressable>
  );
}
