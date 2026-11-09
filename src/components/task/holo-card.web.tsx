import { useId, type JSX } from "react";
import { Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg";

import { holoCardHeight, type HoloCardProps } from "./holo-shared";

import { fonts } from "@/components/ui/theme";

/**
 * Web: the holo card held still — the pastel foil as an SVG gradient on the wordmark, no tilt
 * (the native card's Skia shaders would need Skia's WebAssembly build on web).
 */
export function HoloCard({
  width,
  word,
  footer,
  corner,
  accessibilityLabel,
}: HoloCardProps): JSX.Element {
  const height = holoCardHeight(width);
  const id = `foil-${useId().replace(/:/g, "")}`;
  const wordSize = height * 0.58;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{
        width,
        height,
        borderRadius: 16,
        backgroundColor: "#0b0b0d",
        borderWidth: 1.5,
        borderColor: "rgba(206,190,255,0.7)",
        overflow: "hidden",
        boxShadow: "0 12px 24px rgba(0,0,0,0.5)",
      }}
    >
      <Svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0.6">
            <Stop offset="0" stopColor="rgb(255,179,230)" />
            <Stop offset="0.25" stopColor="rgb(184,168,255)" />
            <Stop offset="0.5" stopColor="rgb(158,235,255)" />
            <Stop offset="0.75" stopColor="rgb(199,255,214)" />
            <Stop offset="1" stopColor="rgb(255,242,173)" />
          </LinearGradient>
        </Defs>
        <SvgText
          x={14}
          y={height * 0.69}
          fill={`url(#${id})`}
          fontFamily={fonts.condensed}
          fontSize={wordSize}
          textLength={width - 28}
          lengthAdjust="spacingAndGlyphs"
        >
          {word}
        </SvgText>
      </Svg>
      <View
        style={{
          position: "absolute",
          left: 14,
          right: 14,
          bottom: 10,
          flexDirection: "row",
          alignItems: "flex-end",
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: "#ffffff" }}>
            {footer[0]}
          </Text>
          <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: "#ffffff" }}>
            {footer[1]}
          </Text>
        </View>
        <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: "#ffffff" }}>{corner}</Text>
      </View>
    </View>
  );
}
