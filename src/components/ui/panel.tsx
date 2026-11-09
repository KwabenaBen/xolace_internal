import type { JSX, ReactNode } from "react";
import { Text, View } from "react-native";

import { fonts, usePageColors } from "./theme";

/** A rounded panel in the theme's panel colour, with a heading. */
export function Panel({
  s,
  title,
  aside,
  children,
}: {
  s: number;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  const c = usePageColors();
  return (
    <View
      style={{
        borderRadius: 26 * s,
        backgroundColor: c.panel,
        borderWidth: 1,
        borderColor: c.hairline,
        padding: 18 * s,
        gap: 14 * s,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={1.3}
          style={{
            flex: 1,
            fontFamily: fonts.extraBold,
            fontSize: 17 * s,
            color: c.text,
          }}
        >
          {title}
        </Text>
        {aside}
      </View>
      {children}
    </View>
  );
}

/** A section heading on the page, with an optional count. */
export function SectionTitle({
  s,
  title,
  count,
}: {
  s: number;
  title: string;
  count?: number;
}): JSX.Element {
  const c = usePageColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, paddingHorizontal: 4 }}>
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={1.3}
        style={{ fontFamily: fonts.extraBold, fontSize: 18 * s, color: c.text }}
      >
        {title}
      </Text>
      {count !== undefined ? (
        <Text
          maxFontSizeMultiplier={1.3}
          style={{ fontFamily: fonts.semibold, fontSize: 14 * s, color: c.muted }}
        >
          {count}
        </Text>
      ) : null}
    </View>
  );
}
