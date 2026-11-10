import * as Haptics from "expo-haptics";
import { useEffect, type JSX } from "react";
import { Platform, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { SheetNoSwipe } from "@/components/ui/sheet";
import { colors, fonts, usePageColors } from "@/components/ui/theme";

import { OdometerDigit } from "./odometer";

const STEP = 5;
const KNOB = 40;
const TRACK = 52;
const SETTLE = { damping: 22, stiffness: 260 } as const;

/**
 * A task's progress, set by dragging (or tapping) a thick bar: the fill follows the finger, the
 * value snaps to 5% steps, the number above rolls like an odometer and each step gives a light
 * tap on iPhone. VoiceOver: swipe up or down to change it by 5%. For use inside a Sheet (a drag
 * that starts on the bar never moves the card).
 */
export function ProgressSlider({
  value,
  onChange,
  label = "Progress",
}: {
  value: number;
  onChange: (value: number) => void;
  label?: string;
}): JSX.Element {
  const c = usePageColors();
  const reduced = useReducedMotion();
  const width = useSharedValue(0);
  // 0–1, following the finger while dragging, else the value.
  const fill = useSharedValue(value / 100);
  const sent = useSharedValue(value);
  const dragging = useSharedValue(false);

  // Changed from outside (or first shown): settle the bar there.
  useEffect(() => {
    if (dragging.get()) return;
    sent.set(value);
    fill.set(reduced ? value / 100 : withSpring(value / 100, SETTLE));
  }, [value, reduced, dragging, fill, sent]);

  function emit(next: number) {
    onChange(next);
    if (Platform.OS !== "web") void Haptics.selectionAsync();
  }

  const toFraction = (x: number) => {
    "worklet";
    const room = width.get() - KNOB;
    if (room <= 0) return 0;
    return Math.min(1, Math.max(0, (x - KNOB / 2) / room));
  };
  const follow = (x: number) => {
    "worklet";
    const fraction = toFraction(x);
    fill.set(fraction);
    const snapped = Math.round((fraction * 100) / STEP) * STEP;
    if (snapped !== sent.get()) {
      sent.set(snapped);
      scheduleOnRN(emit, snapped);
    }
  };

  const drag = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      dragging.set(true);
      follow(e.x);
    })
    .onUpdate((e) => follow(e.x))
    .onFinalize(() => {
      dragging.set(false);
      fill.set(reduced ? sent.get() / 100 : withSpring(sent.get() / 100, SETTLE));
    });

  const fillStyle = useAnimatedStyle(() => ({
    width: KNOB + fill.get() * Math.max(0, width.get() - KNOB),
  }));

  const digits = { height: 52, width: 30 };
  const digitStyle = { fontFamily: fonts.black, fontSize: 46, color: c.text };

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: value, text: `${value}%` }}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-valuetext={`${value}%`}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(e) => {
        const next = e.nativeEvent.actionName === "increment" ? value + STEP : value - STEP;
        onChange(Math.min(100, Math.max(0, next)));
      }}
      style={{ gap: 12 }}
    >
      <View aria-hidden style={{ flexDirection: "row", alignItems: "flex-end" }}>
        {value === 100 ? (
          <OdometerDigit digit={1} {...digits} textStyle={digitStyle} animate={false} />
        ) : null}
        {value >= 10 ? (
          <OdometerDigit
            digit={Math.floor(value / 10) % 10}
            {...digits}
            textStyle={digitStyle}
            animate={!reduced}
          />
        ) : null}
        <OdometerDigit digit={value % 10} {...digits} textStyle={digitStyle} animate={!reduced} />
        <Text
          style={{
            fontFamily: fonts.extraBold,
            fontSize: 22,
            color: c.muted,
            marginLeft: 4,
            marginBottom: 10,
          }}
        >
          %
        </Text>
      </View>
      <SheetNoSwipe>
        <GestureDetector gesture={drag}>
          <View
            onLayout={(e) => width.set(e.nativeEvent.layout.width)}
            style={{
              height: TRACK,
              borderRadius: 999,
              backgroundColor: c.panelHigh,
              borderWidth: 1,
              borderColor: c.hairline,
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {/* quarter marks */}
            {[25, 50, 75].map((mark) => (
              <View
                key={mark}
                style={{
                  position: "absolute",
                  left: `${mark}%`,
                  width: 2,
                  height: 12,
                  borderRadius: 1,
                  backgroundColor: c.hairline,
                }}
              />
            ))}
            <Animated.View
              style={[
                {
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  borderRadius: 999,
                  backgroundColor: colors.lavender,
                  alignItems: "flex-end",
                  justifyContent: "center",
                  paddingRight: (TRACK - KNOB) / 2,
                },
                fillStyle,
              ]}
            >
              <View
                style={{
                  width: KNOB - 8,
                  height: KNOB - 8,
                  borderRadius: 999,
                  backgroundColor: colors.white,
                  borderWidth: 2,
                  borderColor: colors.ink,
                }}
              />
            </Animated.View>
          </View>
        </GestureDetector>
      </SheetNoSwipe>
    </View>
  );
}
