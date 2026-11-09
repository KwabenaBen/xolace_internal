import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps, JSX } from "react";
import { Pressable, ScrollView, Switch, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts, usePageColors } from "@/components/ui/theme";

import { ROW_COUNT, ROW_H, SPACE, TRACK_ON, type Row } from "./crs-theme";

type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

/** The clay icons' symbols and tile colours, as flat icons (the native version draws them in Skia). */
const ICONS: { name: IconName; tile: string }[] = [
  { name: "bell", tile: "rgb(245,110,94)" },
  { name: "moon-waning-crescent", tile: "rgb(115,102,237)" },
  { name: "account-multiple", tile: "rgb(69,145,250)" },
  { name: "shield-check", tile: "rgb(69,196,115)" },
  { name: "lock", tile: "rgb(107,122,153)" },
];

type Props = {
  rows: Row[];
  section?: string;
  isDark: boolean;
  onDarkChange: (dark: boolean) => void;
  autoPlay?: boolean;
};

/**
 * Web: the Settings screen without the clay scene (its Skia shaders would need Skia's
 * multi-megabyte WebAssembly build, which the planning web app doesn't need). The same rows and
 * the same Dark mode switch, which changes the theme at once.
 */
export function ClayRelightSettings({
  rows,
  section = "GENERAL",
  isDark,
  onDarkChange,
}: Props): JSX.Element {
  const c = usePageColors();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth, 560) - 2 * SPACE.l;

  return (
    <View style={{ flex: 1, backgroundColor: c.page }}>
      <ScrollView
        contentContainerStyle={{
          alignItems: "center",
          paddingTop: insets.top + SPACE.s,
          paddingBottom: SPACE.xxl,
        }}
      >
        <View style={{ width, gap: SPACE.l }}>
          <Text
            accessibilityRole="header"
            style={{ fontFamily: fonts.black, fontSize: 34, letterSpacing: -0.6, color: c.text }}
          >
            Settings
          </Text>

          <View
            style={{
              borderRadius: 28,
              backgroundColor: c.panel,
              padding: SPACE.l + SPACE.xs,
              flexDirection: "row",
              alignItems: "center",
              gap: SPACE.m,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: c.text }}>
                Dark mode
              </Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: c.muted }}>
                {isDark ? "On · Cadence in night colours" : "Off · Cadence in day colours"}
              </Text>
            </View>
            <Switch
              accessibilityLabel="Dark mode"
              value={isDark}
              onValueChange={onDarkChange}
              trackColor={{ false: c.panelHigh, true: TRACK_ON }}
            />
          </View>

          <Text
            style={{
              fontFamily: fonts.semibold,
              fontSize: 13,
              letterSpacing: 0.6,
              color: c.muted,
              paddingHorizontal: SPACE.l,
            }}
          >
            {section}
          </Text>
          <View style={{ borderRadius: 28, backgroundColor: c.panel, overflow: "hidden" }}>
            {rows.slice(0, ROW_COUNT).map((row, i) => (
              <Pressable
                key={row.title}
                disabled={row.onPress === undefined}
                onPress={row.onPress}
                accessibilityRole={row.onPress !== undefined ? "button" : "text"}
                accessibilityLabel={row.day !== "" ? `${row.title}, ${row.day}` : row.title}
                accessibilityHint={row.hint}
                style={({ pressed }) => ({
                  height: ROW_H,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: SPACE.m,
                  paddingHorizontal: SPACE.l,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: c.hairline,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    backgroundColor: ICONS[i]?.tile,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialCommunityIcons
                    name={ICONS[i]?.name ?? "cog"}
                    size={18}
                    color="#FFFFFF"
                  />
                </View>
                <Text
                  numberOfLines={1}
                  style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: c.text }}
                >
                  {row.title}
                </Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: c.muted }}>
                  {isDark ? row.night : row.day}
                </Text>
                {row.onPress !== undefined ? (
                  <MaterialCommunityIcons name="chevron-right" size={20} color={c.muted} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
