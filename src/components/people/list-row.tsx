import type { JSX, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { fonts, usePageColors } from "@/components/ui/theme";

/**
 * The reference's "Already Chatted with" row: a card in the panel colour with an avatar, a bold
 * line and a grey one under it, a short note at the top right (where the reference shows the
 * time) and an optional dot under it (its unread badge). Tapping opens the row's actions.
 */
export function ListRow({
  s,
  avatar,
  title,
  line,
  aside,
  dot,
  label,
  hint,
  onPress,
}: {
  s: number;
  avatar: ReactNode;
  title: string;
  line: string;
  aside?: string;
  /** A small coloured dot under `aside`, for "needs attention". */
  dot?: string;
  /** Everything the row says, for screen readers. */
  label: string;
  hint?: string;
  onPress?: () => void;
}): JSX.Element {
  const c = usePageColors();
  return (
    <Pressable
      disabled={onPress === undefined}
      onPress={onPress}
      accessibilityRole={onPress !== undefined ? "button" : undefined}
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12 * s,
        borderRadius: 24 * s,
        backgroundColor: c.panel,
        borderWidth: 1,
        borderColor: c.hairline,
        paddingVertical: 12 * s,
        paddingLeft: 12 * s,
        paddingRight: 16 * s,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {avatar}
      <View style={{ flex: 1, gap: 3 }}>
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
          style={{ fontFamily: fonts.semibold, fontSize: 15 * s, color: c.text }}
        >
          {title}
        </Text>
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
          style={{ fontFamily: fonts.medium, fontSize: 13 * s, color: c.muted }}
        >
          {line}
        </Text>
      </View>
      {aside !== undefined || dot !== undefined ? (
        <View style={{ alignItems: "flex-end", gap: 6 * s, alignSelf: "stretch" }}>
          {aside !== undefined ? (
            <Text
              maxFontSizeMultiplier={1.3}
              style={{ fontFamily: fonts.medium, fontSize: 12 * s, color: c.muted }}
            >
              {aside}
            </Text>
          ) : null}
          {dot !== undefined ? (
            <View
              style={{ width: 10 * s, height: 10 * s, borderRadius: 999, backgroundColor: dot }}
            />
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}
