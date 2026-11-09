import type { JSX } from "react";
import { Text, View } from "react-native";

import { initials } from "@/components/task/people-cards";
import { Sym, type SymbolSpec } from "@/components/ui/sym";
import { colors, fonts, usePageColors } from "@/components/ui/theme";

const PASTELS = [
  colors.lavender,
  colors.peach,
  colors.sky,
  colors.pink,
  colors.rose,
  colors.yellow,
  colors.green,
] as const;

/** A steady pastel for a person or an invite, picked from its id: the same colour every time. */
export function pastelFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PASTELS[Math.abs(hash) % PASTELS.length];
}

/**
 * The People page's round avatar, after the reference's memoji circles: initials (or an icon) in
 * black on a pastel, with a white ring. The pastels are stickers, the same in both themes. With
 * `isAdmin`, a small violet "Admin" tag sits across the bottom edge.
 */
export function Avatar({
  size,
  fill,
  name,
  symbol,
  isAdmin = false,
  dim = false,
}: {
  size: number;
  fill: string;
  /** Shows their initials. */
  name?: string;
  /** Shows an icon instead (e.g. an envelope for an invite). */
  symbol?: SymbolSpec;
  isAdmin?: boolean;
  dim?: boolean;
}): JSX.Element {
  const c = usePageColors();
  return (
    <View style={{ width: size, height: size, opacity: dim ? 0.45 : 1 }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          backgroundColor: fill,
          borderWidth: 2,
          borderColor: colors.white,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {symbol !== undefined ? (
          <Sym symbol={symbol} size={size * 0.4} color={colors.ink} />
        ) : (
          <Text
            maxFontSizeMultiplier={1.2}
            style={{ fontFamily: fonts.extraBold, fontSize: size * 0.32, color: colors.ink }}
          >
            {initials(name ?? "")}
          </Text>
        )}
      </View>
      {isAdmin ? (
        <View
          style={{
            position: "absolute",
            bottom: -size * 0.12,
            alignSelf: "center",
            borderRadius: 999,
            borderWidth: 2,
            // the panel's colour, so the tag reads as cut out of the ring
            borderColor: c.panel,
            backgroundColor: colors.violet,
            paddingHorizontal: 6,
            paddingVertical: 1,
          }}
        >
          <Text
            maxFontSizeMultiplier={1.2}
            style={{ fontFamily: fonts.bold, fontSize: 9, color: colors.white }}
          >
            Admin
          </Text>
        </View>
      ) : null}
    </View>
  );
}
