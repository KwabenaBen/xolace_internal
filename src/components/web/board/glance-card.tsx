import { Ionicons } from "@expo/vector-icons";
import type { JSX } from "react";
import { Pressable, Text, View } from "react-native";

import { colors, fonts, usePageColors } from "@/components/ui/theme";

import { useHover } from "../use-hover";
import { webType } from "../web-theme";

export type GlanceItem = {
  label: string;
  count: number;
  /** A sticker colour for the count's dot. */
  dot: string;
  onOpen: () => void;
};

function GlanceRow({ item, last }: { item: GlanceItem; last: boolean }): JSX.Element {
  const c = usePageColors();
  const [hovered, hover] = useHover();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${item.label}: ${item.count}`}
      onPress={item.onOpen}
      {...hover}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: hovered ? c.panelRaised : "transparent",
        borderBottomWidth: last || hovered ? 0 : 1,
        borderBottomColor: c.hairline,
      }}
    >
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          backgroundColor: item.dot,
          borderWidth: 1,
          borderColor: colors.ink,
        }}
      />
      <Text style={{ ...webType.body, flex: 1, color: c.text }}>{item.label}</Text>
      <Text style={{ fontFamily: fonts.extraBold, fontSize: 18, color: c.text }}>{item.count}</Text>
      <Ionicons name="chevron-forward" size={14} color={c.muted} />
    </Pressable>
  );
}

/**
 * The team's numbers next to "Next up" (the phone's bento tiles, as a list): each opens its page.
 * They count the whole team, whatever the filters.
 */
export function GlanceCard({ items }: { items: GlanceItem[] }): JSX.Element {
  const c = usePageColors();
  return (
    <View
      style={{
        borderRadius: 22,
        borderWidth: 1,
        borderColor: c.hairline,
        backgroundColor: c.panel,
        padding: 12,
        paddingTop: 18,
        gap: 4,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{
          fontFamily: fonts.extraBold,
          fontSize: 16,
          letterSpacing: -0.3,
          color: c.text,
          paddingHorizontal: 12,
          paddingBottom: 4,
        }}
      >
        At a glance
      </Text>
      {items.map((item, i) => (
        <GlanceRow key={item.label} item={item} last={i === items.length - 1} />
      ))}
    </View>
  );
}
