import type { JSX } from "react";
import { Text, View } from "react-native";

export type LiquidButtonProps = {
  label: string;
  /** The shapes' colour. */
  fill: string;
  /** The words' and arrow's colour (passes 4.5:1 on `fill`). */
  ink: string;
  /** Hovered or focused (by the button itself or the card it's part of): the shapes fuse. */
  active: boolean;
  /** Its height. */
  size?: number;
};

/**
 * The website layout's "liquid arrow" button lives in liquid-button.web.tsx (GSAP and an SVG
 * filter). The app never shows it; this is a plain pill and circle, so nothing web-only gets
 * bundled into the iPhone app.
 */
export function LiquidButton({ label, fill, ink, size = 36 }: LiquidButtonProps): JSX.Element {
  return (
    <View aria-hidden style={{ flexDirection: "row", alignItems: "center", gap: size * 0.28 }}>
      <View
        style={{
          height: size,
          borderRadius: size,
          paddingHorizontal: size * 0.5,
          justifyContent: "center",
          backgroundColor: fill,
        }}
      >
        <Text style={{ color: ink, fontWeight: "700" }}>{label}</Text>
      </View>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: fill,
        }}
      >
        <Text style={{ color: ink, fontWeight: "700" }}>→</Text>
      </View>
    </View>
  );
}
