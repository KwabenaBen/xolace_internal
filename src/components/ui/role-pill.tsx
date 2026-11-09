import type { JSX } from "react";
import { Text, View } from "react-native";

import type { Role } from "@convex/lib/validators";

import { ROLE_LABELS } from "@/constants/labels";

import { colors, fonts, usePageColors } from "./theme";

/**
 * Someone's role as a small pill: Admin in the app's solid violet, Member as an outline in the
 * text colour (a cream fill vanished into the off-white theme's cream panels).
 */
export function RolePill({ role }: { role: Role }): JSX.Element {
  const c = usePageColors();
  const isAdmin = role === "admin";
  return (
    <View
      style={{
        borderRadius: 999,
        borderWidth: 1,
        borderColor: isAdmin ? colors.violet : c.muted,
        backgroundColor: isAdmin ? colors.violet : "transparent",
        paddingHorizontal: 10,
        paddingVertical: 3,
        alignSelf: "flex-start",
      }}
    >
      <Text
        maxFontSizeMultiplier={1.3}
        style={{ fontFamily: fonts.bold, fontSize: 11, color: isAdmin ? colors.white : c.text }}
      >
        {ROLE_LABELS[role]}
      </Text>
    </View>
  );
}
