import { useState, type JSX, type ReactNode } from "react";
import { Pressable } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";

import { press } from "./board-theme";
import { pitTile } from "./pit-stop";

type BentoTileProps = {
  /** Position in the pit stop's reading order (see TILE in pit-stop.ts). */
  index: number;
  /** Size in reference points; multiplied by `s`. */
  width: number;
  height: number;
  corner: number;
  s: number;
  pit: SharedValue<number>;
  fill: string;
  /** Read by screen readers as the whole tile. */
  label: string;
  onPress?: () => void;
  children: ReactNode;
};

/**
 * A bento tile: its pit-stop pose runs on the UI thread, and a press shrinks it to 97 %
 * (100 ms in, 180 ms out, ease-out) before committing on release, as in the reference.
 */
export function BentoTile({
  index,
  width,
  height,
  corner,
  s,
  pit,
  fill,
  label,
  onPress,
  children,
}: BentoTileProps): JSX.Element {
  const [pressed, setPressed] = useState(false);
  const pose = useAnimatedStyle(() => {
    const p = pitTile(index, pit.get());
    return {
      transform: [
        { translateX: p.x * s },
        { translateY: p.y * s },
        { rotate: `${p.rotate}deg` },
        { scaleX: p.sx },
        { scaleY: p.sy },
      ],
    };
  });

  return (
    <Animated.View style={[{ width: width * s, height: height * s }, pose]}>
      <Pressable
        disabled={onPress === undefined}
        accessible
        accessibilityRole={onPress !== undefined ? "button" : "summary"}
        accessibilityLabel={label}
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={{ flex: 1 }}
      >
        <Animated.View
          style={{
            flex: 1,
            borderRadius: corner * s,
            borderCurve: "continuous",
            backgroundColor: fill,
            overflow: "hidden",
            transform: [{ scale: pressed ? press.scale : 1 }],
            transitionProperty: "transform",
            transitionDuration: pressed ? press.inMs : press.outMs,
            transitionTimingFunction: "ease-out",
          }}
        >
          {children}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}
