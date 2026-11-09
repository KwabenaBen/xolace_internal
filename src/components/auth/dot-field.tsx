import { Canvas, Path, useClock, usePathValue } from "@shopify/react-native-skia";
import type { JSX } from "react";
import { View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import {
  DOT_COUNT,
  DOT_FIELD_ASPECT,
  dotFieldScale,
  dotPosition,
  dotRadius,
  WORD,
  WORD_HOLD_TIME,
} from "./dot-formations";

export type DotFieldProps = { width: number };

/**
 * iOS/Android: the dots are rebuilt into one Skia path every frame on the UI thread, so the
 * JS thread stays free. Web has its own canvas version (dot-field.web.tsx).
 */
export function DotField({ width }: DotFieldProps): JSX.Element {
  const height = Math.round(width * DOT_FIELD_ASPECT);
  const scale = dotFieldScale(width);
  const radius = dotRadius(width);
  const centerX = width / 2;
  const centerY = height / 2;
  const reduceMotion = useReducedMotion();
  const clock = useClock();

  const path = usePathValue((builder) => {
    "worklet";
    // With Reduce Motion on, hold the frame where the dots spell the word.
    const t = reduceMotion ? WORD_HOLD_TIME : clock.value / 1000;
    for (let i = 0; i < DOT_COUNT; i++) {
      const [x, y] = dotPosition(i, t);
      builder.addCircle(centerX + x * scale, centerY + y * scale, radius);
    }
  });

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={WORD}>
      <Canvas style={{ width, height }}>
        <Path path={path} color="white" />
      </Canvas>
    </View>
  );
}
