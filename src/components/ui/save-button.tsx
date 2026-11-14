import { Canvas, Circle, Group, Line, Path, Skia, vec } from "@shopify/react-native-skia";
import { useEffect, useRef, useState, type JSX } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import {
  CHECK_PATH,
  headPath,
  ICON,
  shaftEnds,
  wavePath,
  type SaveButtonProps,
} from "./save-button-shapes";
import { usePageColors } from "./theme";

export type { SaveButtonProps };

const LINE = 22;
const ROLL = { duration: 440, easing: Easing.out(Easing.back(1.4)) };
/** How long "Saved ✓" stays before onDone. */
const HOLD_MS = 450;
/** At the latest, onDone this long after the save, even if the motion hasn't finished. */
const FALLBACK_MS = 2500;

/** The disc to clip the liquid to (two half-circle arcs). */
const R = ICON / 2;
const DISC =
  Skia.Path.MakeFromSVGString(
    `M 0 ${R} A ${R} ${R} 0 1 0 ${ICON} ${R} A ${R} ${R} 0 1 0 0 ${R} Z`
  ) ?? Skia.Path.Make();
const CHECK = Skia.Path.MakeFromSVGString(CHECK_PATH) ?? Skia.Path.Make();

/**
 * A form's save button, after the team's "Download buttons" reference (save-button-shapes.ts has
 * the drawing): the theme's pill with its words and, at the end, an arrow in a disc. Press it and
 * the words roll up to "Saving" while the arrow collapses and the disc fills with liquid; once
 * saved the words roll to "Saved" and a check draws in, then `onDone`. If the save fails it all
 * drains back. The icon is drawn with Skia on the UI thread (Reanimated values), so nothing waits
 * on React. Reduce Motion: the words and icon switch without moving.
 */
export function SaveButton({
  labels,
  validate,
  onPress,
  onDone,
  isDisabled = false,
}: SaveButtonProps): JSX.Element {
  const c = usePageColors();
  const reduced = useReducedMotion();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  const roll = useSharedValue(0); // 0 idle, 1 busy, 2 done
  const press = useSharedValue(1);
  const flat = useSharedValue(0);
  const headOpacity = useSharedValue(1);
  const drop = useSharedValue(0);
  const tickOpacity = useSharedValue(1);
  const level = useSharedValue(0);
  const phase = useSharedValue(0);
  const check = useSharedValue(0);

  // Once the button has gone (its form was closed, e.g. while it said "Saved"), nothing it
  // scheduled may run: no onDone (it would navigate from wherever the app is now), no animation.
  const mounted = useRef(true);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    mounted.current = true;
    const pending = timers.current;
    return () => {
      mounted.current = false;
      pending.forEach(clearTimeout);
      cancelAnimation(phase);
    };
  }, [phase]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const wave = useDerivedValue(
    () => Skia.Path.MakeFromSVGString(wavePath(level.get(), phase.get())) ?? Skia.Path.Make()
  );
  const head = useDerivedValue(
    () => Skia.Path.MakeFromSVGString(headPath(flat.get())) ?? Skia.Path.Make()
  );
  const shaftTop = useDerivedValue(() => vec(ICON / 2, shaftEnds(drop.get(), level.get()).y1));
  const shaftBottom = useDerivedValue(() => vec(ICON / 2, shaftEnds(drop.get(), level.get()).y2));
  const labelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -roll.get() * LINE }],
  }));
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.get() }] }));

  function start() {
    if (reduced) {
      roll.set(1);
      flat.set(1);
      headOpacity.set(0);
      drop.set(1);
      level.set(0.6);
      return;
    }
    roll.set(withTiming(1, ROLL));
    flat.set(withTiming(1, { duration: 260 }));
    headOpacity.set(withDelay(220, withTiming(0, { duration: 160 })));
    drop.set(withTiming(1, { duration: 340, easing: Easing.in(Easing.quad) }));
    level.set(
      withDelay(240, withTiming(0.82, { duration: 1600, easing: Easing.out(Easing.quad) }))
    );
    phase.set(0);
    phase.set(withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1, false));
  }

  function finish() {
    // It's saved: carry on once the check has shown, or within a moment whatever the motion does.
    let carriedOn = false;
    const carryOn = () => {
      if (carriedOn || !mounted.current) return;
      carriedOn = true;
      onDone?.();
    };
    later(carryOn, FALLBACK_MS);
    const done = () => later(carryOn, HOLD_MS);
    if (reduced) {
      level.set(1);
      tickOpacity.set(0);
      roll.set(2);
      check.set(1);
      done();
      return;
    }
    level.set(withTiming(1, { duration: 340, easing: Easing.out(Easing.quad) }));
    tickOpacity.set(withTiming(0, { duration: 180 }));
    roll.set(withDelay(220, withTiming(2, ROLL)));
    check.set(
      withDelay(
        300,
        withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }, (finished) => {
          if (finished === true) scheduleOnRN(done);
        })
      )
    );
  }

  function revert() {
    cancelAnimation(phase);
    const timing = (to: number, ms = 320) => (reduced ? to : withTiming(to, { duration: ms }));
    level.set(timing(0, 380));
    drop.set(timing(0));
    tickOpacity.set(timing(1));
    flat.set(timing(0));
    headOpacity.set(timing(1, 200));
    roll.set(reduced ? 0 : withTiming(0, ROLL));
  }

  async function go() {
    if (state !== "idle" || isDisabled) return;
    if (validate !== undefined && !validate()) return;
    setState("busy");
    start();
    const saved = await onPress();
    if (!mounted.current) return; // closed while it was saving
    if (!saved) {
      revert();
      setState("idle");
      return;
    }
    setState("done");
    cancelAnimation(phase);
    finish();
  }

  const label = labels[state];
  const ink = c.accentText;
  const text = { color: ink, fontSize: 16, lineHeight: LINE, fontWeight: "700" as const };

  return (
    <Animated.View style={[{ width: "100%" }, pillStyle]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: isDisabled || state !== "idle", busy: state === "busy" }}
        disabled={isDisabled}
        onPress={() => void go()}
        onPressIn={() => press.set(reduced ? 1 : withTiming(0.97, { duration: 110 }))}
        onPressOut={() => press.set(reduced ? 1 : withTiming(1, { duration: 200 }))}
        style={{
          height: 56,
          borderRadius: 999,
          backgroundColor: c.accent,
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: 24,
          paddingRight: 8,
          opacity: isDisabled ? 0.5 : 1,
        }}
      >
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ flex: 1, height: LINE, overflow: "hidden", alignItems: "center" }}
        >
          <Animated.View style={[{ alignItems: "center" }, labelStyle]}>
            <Text style={text}>{labels.idle}</Text>
            <Text style={text}>{labels.busy}</Text>
            <Text style={text}>{labels.done}</Text>
          </Animated.View>
        </View>
        <Canvas style={{ width: ICON, height: ICON }}>
          <Circle cx={ICON / 2} cy={ICON / 2} r={ICON / 2} color={ink} opacity={0.14} />
          <Group clip={DISC}>
            <Path path={wave} color={ink} opacity={0.24} />
          </Group>
          <Path
            path={head}
            style="stroke"
            strokeWidth={2.4}
            strokeCap="round"
            strokeJoin="round"
            color={ink}
            opacity={headOpacity}
          />
          <Line
            p1={shaftTop}
            p2={shaftBottom}
            style="stroke"
            strokeWidth={2.4}
            strokeCap="round"
            color={ink}
            opacity={tickOpacity}
          />
          <Path
            path={CHECK}
            style="stroke"
            strokeWidth={2.4}
            strokeCap="round"
            strokeJoin="round"
            color={ink}
            start={0}
            end={check}
          />
        </Canvas>
      </Pressable>
    </Animated.View>
  );
}
