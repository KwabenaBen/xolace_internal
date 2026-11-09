import { useId, useState, type JSX, type ReactNode } from "react";
import { Text as RNText, View, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, Path, Rect, Text, TextPath } from "react-native-svg";

import { colors, fonts } from "@/components/ui/theme";

/*
 Stickers and pen marks for a person's card, after the reference's cut-out stickers (a scalloped
 seal with words round the edge, an envelope, a heart) and its hand-drawn circle and zigzag.
 All decoration: hidden from screen readers, which get the same facts from the card's text.
 Sticker colours are the app's sticker palette, the same in both themes, with a white cut edge.
*/

const CUT = colors.white;

function Sticker({
  size,
  rotate,
  style,
  children,
}: {
  size: number;
  rotate: number;
  style?: ViewStyle;
  children: ReactNode;
}): JSX.Element {
  return (
    <View
      aria-hidden
      style={[
        { position: "absolute", pointerEvents: "none", transform: [{ rotate: `${rotate}deg` }] },
        style,
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {children}
      </Svg>
    </View>
  );
}

/**
 * A scalloped seal with `words` running round its edge twice (each copy starts half-way round, so
 * they're evenly spaced and never run into each other) and a drawn asterisk in the middle.
 */
export function Seal({
  size,
  words,
  fill = colors.pink,
  ink = colors.ink,
  rotate = 12,
  style,
}: {
  size: number;
  words: string;
  fill?: string;
  ink?: string;
  rotate?: number;
  style?: ViewStyle;
}): JSX.Element {
  // an id for the text's circle, unique per seal (useId's colons kept out of the SVG reference)
  const ring = `seal${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const bumps = Array.from({ length: 18 }, (_, i) => (i / 18) * Math.PI * 2);
  return (
    <Sticker size={size} rotate={rotate} style={style}>
      <Defs>
        <Path id={ring} d="M 50,50 m -30,0 a 30,30 0 1,1 60,0 a 30,30 0 1,1 -60,0" />
      </Defs>
      {/* the white cut edge, then the scallops */}
      <G fill={CUT}>
        <Circle cx={50} cy={50} r={46} />
        {bumps.map((a) => (
          <Circle key={`c${a}`} cx={50 + 43 * Math.cos(a)} cy={50 + 43 * Math.sin(a)} r={8} />
        ))}
      </G>
      <G fill={fill}>
        <Circle cx={50} cy={50} r={43} />
        {bumps.map((a) => (
          <Circle key={`f${a}`} cx={50 + 41 * Math.cos(a)} cy={50 + 41 * Math.sin(a)} r={6} />
        ))}
      </G>
      <Circle cx={50} cy={50} r={37} fill="none" stroke={ink} strokeWidth={1} />
      {["0%", "50%"].map((offset) => (
        <Text key={offset} fill={ink} fontSize={7} fontFamily={fonts.bold} letterSpacing={0.5}>
          <TextPath href={`#${ring}`} startOffset={offset}>
            {words}
          </TextPath>
        </Text>
      ))}
      <G stroke={ink} strokeWidth={3.2} strokeLinecap="round">
        {[0, 45, 90, 135].map((deg) => {
          const r = (deg * Math.PI) / 180;
          const dx = 9 * Math.cos(r);
          const dy = 9 * Math.sin(r);
          return <Path key={deg} d={`M ${50 - dx} ${50 - dy} L ${50 + dx} ${50 + dy}`} />;
        })}
      </G>
    </Sticker>
  );
}

/** An envelope sticker: their email. */
export function EnvelopeSticker({
  size,
  rotate = -14,
  style,
}: {
  size: number;
  rotate?: number;
  style?: ViewStyle;
}): JSX.Element {
  return (
    <Sticker size={size} rotate={rotate} style={style}>
      <Rect x={6} y={18} width={88} height={64} rx={12} fill={CUT} />
      <Rect x={11} y={23} width={78} height={54} rx={9} fill={colors.yellow} />
      <Rect
        x={24}
        y={34}
        width={52}
        height={34}
        rx={3}
        fill="none"
        stroke={colors.ink}
        strokeWidth={3.5}
      />
      <Path
        d="M 25 36 L 50 54 L 75 36"
        fill="none"
        stroke={colors.ink}
        strokeWidth={3.5}
        strokeLinejoin="round"
      />
    </Sticker>
  );
}

/** A heart sticker: on your own card. */
export function HeartSticker({
  size,
  rotate = 10,
  style,
}: {
  size: number;
  rotate?: number;
  style?: ViewStyle;
}): JSX.Element {
  const heart =
    "M50 86 C 16 64, 8 38, 26 24 C 38 15, 48 24, 50 32 C 52 24, 62 15, 74 24 C 92 38, 84 64, 50 86 Z";
  return (
    <Sticker size={size} rotate={rotate} style={style}>
      <Path d={heart} fill={colors.pink} stroke={CUT} strokeWidth={8} strokeLinejoin="round" />
      <Path
        d="M 40 58 C 34 48, 44 40, 50 46 C 56 52, 62 44, 58 38"
        fill="none"
        stroke={colors.ink}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </Sticker>
  );
}

/** A round green stamp with a tick: the admin task reviewer. */
export function CheckStamp({
  size,
  rotate = -10,
  style,
}: {
  size: number;
  rotate?: number;
  style?: ViewStyle;
}): JSX.Element {
  return (
    <Sticker size={size} rotate={rotate} style={style}>
      <Circle cx={50} cy={50} r={44} fill={CUT} />
      <Circle cx={50} cy={50} r={38} fill={colors.green} />
      <Circle
        cx={50}
        cy={50}
        r={31}
        fill="none"
        stroke={colors.ink}
        strokeWidth={1.5}
        strokeDasharray="3 4"
      />
      <Path
        d="M 34 51 L 45 62 L 67 39"
        fill="none"
        stroke={colors.ink}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Sticker>
  );
}

/** A pen zigzag, drawn under a word. */
export function Zigzag({
  width,
  color = colors.red,
}: {
  width: number;
  color?: string;
}): JSX.Element {
  const step = 9;
  const points = Math.max(2, Math.floor(width / step));
  const d = Array.from(
    { length: points + 1 },
    (_, i) => `${i === 0 ? "M" : "L"} ${(i * width) / points} ${i % 2 === 0 ? 8 : 2}`
  ).join(" ");
  return (
    <View aria-hidden style={{ pointerEvents: "none" }}>
      <Svg width={width} height={10}>
        <Path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

/** A quick pen loop drawn round a word: two slightly crooked ellipses. */
export function PenLoop({
  width,
  height,
  color = colors.blue,
}: {
  width: number;
  height: number;
  color?: string;
}): JSX.Element {
  const cx = width / 2;
  const cy = height / 2;
  return (
    <View
      aria-hidden
      style={{ position: "absolute", left: 0, top: 0, width, height, pointerEvents: "none" }}
    >
      <Svg width={width} height={height}>
        <Ellipse
          cx={cx}
          cy={cy}
          rx={cx - 2}
          ry={cy - 2}
          fill="none"
          stroke={color}
          strokeWidth={2.2}
          transform={`rotate(-3 ${cx} ${cy})`}
        />
        <Ellipse
          cx={cx + 2}
          cy={cy - 1}
          rx={cx - 5}
          ry={cy - 3}
          fill="none"
          stroke={color}
          strokeWidth={1.4}
          transform={`rotate(2 ${cx} ${cy})`}
        />
      </Svg>
    </View>
  );
}

/** A word with a pen zigzag under it, sized to the word once it's laid out. */
export function Underlined({ text, size, color }: { text: string; size: number; color: string }) {
  const [width, setWidth] = useState(0);
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ paddingBottom: 2 }}>
      <RNText
        maxFontSizeMultiplier={1.2}
        style={{ fontFamily: fonts.condensed, fontSize: size, lineHeight: size * 1.1, color }}
      >
        {text}
      </RNText>
      {width > 0 ? <Zigzag width={width} /> : null}
    </View>
  );
}

/** Words with a pen loop round them. */
export function Circled({ text, size, color }: { text: string; size: number; color: string }) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  return (
    <View
      onLayout={(e) =>
        setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
      }
      style={{ paddingHorizontal: 12, paddingVertical: 6 }}
    >
      <RNText
        maxFontSizeMultiplier={1.2}
        style={{ fontFamily: fonts.serif, fontSize: size, color, fontStyle: "italic" }}
      >
        {text}
      </RNText>
      {box.width > 0 ? <PenLoop width={box.width} height={box.height} /> : null}
    </View>
  );
}
