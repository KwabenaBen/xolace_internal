import { useEffect, useRef, type JSX } from "react";
import { Text, View, type TextStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

/** The reference's odometer spring: 420/s², damping ratio 0.9. */
const ROLL = { stiffness: 420, damping: 2 * Math.sqrt(420) * 0.9, mass: 1 };

/**
 * One odometer column: a strip of digits 0…(modulus-1) and the first again, clipped to one row.
 * When `digit` changes it rolls the short way round (so a countdown's 0 → 9 rolls back one step,
 * and minutes' tens 0 → 5 roll back one step on a six-digit wheel). With `animate` off (Reduce
 * Motion) it jumps.
 */
export function OdometerDigit({
  digit,
  modulus = 10,
  height,
  width,
  textStyle,
  animate,
}: {
  digit: number;
  /** How many digits the wheel has: 10, or 6 for the tens of minutes and seconds. */
  modulus?: number;
  height: number;
  width: number;
  textStyle: TextStyle;
  animate: boolean;
}): JSX.Element {
  const pos = useSharedValue(digit);
  const shown = useRef(digit);
  const target = useRef(digit);

  useEffect(() => {
    if (digit === shown.current) return;
    let step = (((digit - shown.current) % modulus) + modulus) % modulus;
    if (step > modulus / 2) step -= modulus;
    shown.current = digit;
    target.current += step;
    pos.set(animate ? withSpring(target.current, ROLL) : target.current);
  }, [digit, modulus, animate, pos]);

  const strip = useAnimatedStyle(() => {
    const p = ((pos.get() % modulus) + modulus) % modulus;
    return { transform: [{ translateY: -p * height }] };
  });

  return (
    <View style={{ height, width, overflow: "hidden" }}>
      <Animated.View style={strip}>
        {Array.from({ length: modulus + 1 }, (_, i) => (
          <Text
            key={i}
            allowFontScaling={false}
            style={[textStyle, { height, lineHeight: height, width, textAlign: "center" }]}
          >
            {i % modulus}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}
