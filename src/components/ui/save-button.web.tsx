import { gsap } from "gsap";
import { useId, useLayoutEffect, useRef, useState, type ComponentRef, type JSX } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { usePressScale, useTweenTo, useWebReducedMotion } from "@/components/web/motion";
import { useHover } from "@/components/web/use-hover";
import { webFont } from "@/components/web/web-theme";

import {
  CHECK_LENGTH,
  CHECK_PATH,
  headPath,
  ICON,
  shaftEnds,
  wavePath,
  type SaveButtonProps,
} from "./save-button-shapes";
import { usePageColors } from "./theme";

const LINE = 22;
/** How long "Saved ✓" stays before onDone (s). */
const HOLD = 0.45;
/** At the latest, onDone this long after the save (s), even if the motion hasn't finished. */
const FALLBACK = 2.5;

/** Everything the icon is drawn from; GSAP tweens these numbers and `draw` puts them on screen. */
type IconState = {
  flat: number;
  head: number;
  drop: number;
  tick: number;
  level: number;
  phase: number;
  check: number;
};
const REST: IconState = { flat: 0, head: 1, drop: 0, tick: 1, level: 0, phase: 0, check: 0 };

/**
 * The save button on the web, after the team's "Download buttons" reference: the same pill and
 * icon as the app's (save-button.tsx; the drawing is in save-button-shapes.ts), with GSAP. The
 * words roll up in a clipped line; the icon is an SVG whose shapes are redrawn from a few numbers
 * GSAP eases (the liquid's level and wave, the arrow collapsing, the check drawing in). A wash
 * eases in on hover and it sinks a little when pressed. On the website layout it sits at the end
 * of the dialog's footer, sized to its words. Reduce Motion: it switches without moving.
 */
export function SaveButton({
  labels,
  validate,
  onPress,
  onDone,
  isDisabled = false,
}: SaveButtonProps): JSX.Element {
  const c = usePageColors();
  const reduced = useWebReducedMotion();
  const clipId = `save-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [hovered, hover] = useHover();

  const button = useRef<ComponentRef<typeof Pressable>>(null);
  const wash = useRef<ComponentRef<typeof View>>(null);
  const words = useRef<ComponentRef<typeof View>>(null);
  const wave = useRef<SVGPathElement>(null);
  const head = useRef<SVGPathElement>(null);
  const shaft = useRef<SVGLineElement>(null);
  const checkMark = useRef<SVGPathElement>(null);
  const icon = useRef<IconState>({ ...REST });
  const ctx = useRef<gsap.Context | null>(null);
  const pressScale = usePressScale(button);
  useTweenTo(wash, { opacity: hovered && state === "idle" && !isDisabled ? 1 : 0 }, 0.2);

  useLayoutEffect(() => {
    ctx.current = gsap.context(() => {});
    return () => {
      ctx.current?.revert();
      ctx.current = null;
    };
  }, []);

  /** Puts the icon's numbers on screen. */
  function draw() {
    const s = icon.current;
    wave.current?.setAttribute("d", wavePath(s.level, s.phase));
    head.current?.setAttribute("d", headPath(s.flat));
    head.current?.setAttribute("opacity", String(s.head));
    const { y1, y2 } = shaftEnds(s.drop, s.level);
    shaft.current?.setAttribute("y1", String(y1));
    shaft.current?.setAttribute("y2", String(y2));
    shaft.current?.setAttribute("opacity", String(s.tick));
    checkMark.current?.setAttribute("stroke-dashoffset", String(CHECK_LENGTH * (1 - s.check)));
  }

  /** Eases the icon's numbers (and the words) to `to`, then resolves. */
  function tween(to: Partial<IconState>, duration: number, ease: string, delay = 0) {
    return new Promise<void>((resolve) => {
      const context = ctx.current;
      if (context === null) return resolve();
      context.add(() => {
        if (reduced) {
          Object.assign(icon.current, to);
          draw();
          resolve();
          return;
        }
        gsap.to(icon.current, {
          ...to,
          duration,
          ease,
          delay,
          overwrite: "auto",
          onUpdate: draw,
          onComplete: () => resolve(),
        });
      });
    });
  }

  function rollTo(index: number, delay = 0) {
    const el = words.current;
    const context = ctx.current;
    if (el === null || context === null) return;
    context.add(() => {
      gsap.to(el, { y: -index * LINE, duration: reduced ? 0 : 0.44, ease: "back.out(1.4)", delay });
    });
  }

  function startWave() {
    const context = ctx.current;
    if (context === null || reduced) return;
    context.add(() => {
      icon.current.phase = 0;
      gsap.to(icon.current, {
        phase: 1,
        duration: 0.9,
        ease: "none",
        repeat: -1,
        onUpdate: draw,
      });
    });
  }

  function stopWave() {
    gsap.killTweensOf(icon.current, "phase");
  }

  async function go() {
    if (state !== "idle" || isDisabled) return;
    if (validate !== undefined && !validate()) return;
    setState("busy");
    rollTo(1);
    void tween({ flat: 1 }, 0.26, "power1.out");
    void tween({ head: 0 }, 0.16, "power1.out", 0.22);
    void tween({ drop: 1 }, 0.34, "power2.in");
    void tween({ level: 0.82 }, 1.6, "power2.out", 0.24);
    startWave();

    const saved = await onPress();
    if (!saved) {
      stopWave();
      rollTo(0);
      void tween({ level: 0 }, 0.38, "power2.out");
      void tween({ drop: 0, tick: 1, flat: 0 }, 0.32, "power2.out");
      void tween({ head: 1 }, 0.2, "power1.out", 0.12);
      setState("idle");
      return;
    }
    setState("done");
    // It's saved: whatever happens to the motion, carry on within a moment. A throttled or hidden
    // tab draws few frames, and GSAP stretches its tweens rather than skip them.
    let carriedOn = false;
    const carryOn = () => {
      if (carriedOn) return;
      carriedOn = true;
      onDone?.();
    };
    setTimeout(carryOn, FALLBACK * 1000);
    void tween({ tick: 0 }, 0.18, "power1.out");
    await tween({ level: 1 }, 0.34, "power2.out");
    stopWave();
    rollTo(2);
    await tween({ check: 1 }, 0.38, "power3.out", 0.08);
    setTimeout(carryOn, HOLD * 1000);
  }

  const ink = c.accentText;
  const label = labels[state];
  const stroke = {
    stroke: ink,
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  return (
    <Pressable
      ref={button}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled || state !== "idle", busy: state === "busy" }}
      disabled={isDisabled}
      onPress={() => void go()}
      {...pressScale}
      {...hover}
      style={{
        alignSelf: "flex-end",
        minWidth: 200,
        height: 48,
        borderRadius: 999,
        backgroundColor: c.accent,
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingLeft: 22,
        paddingRight: 4,
        overflow: "hidden",
        opacity: isDisabled ? 0.5 : 1,
      }}
    >
      <View
        ref={wash}
        style={[StyleSheet.absoluteFill, { opacity: 0, backgroundColor: "rgba(127,127,127,0.18)" }]}
      />
      <View aria-hidden style={{ flex: 1, height: LINE, overflow: "hidden", alignItems: "center" }}>
        <View ref={words} style={{ alignItems: "center" }}>
          {[labels.idle, labels.busy, labels.done].map((word) => (
            <Text
              key={word}
              style={{
                fontFamily: webFont,
                fontSize: 14,
                lineHeight: LINE,
                fontWeight: "700",
                color: ink,
              }}
            >
              {word}
            </Text>
          ))}
        </View>
      </View>
      <svg
        aria-hidden
        width={ICON}
        height={ICON}
        viewBox={`0 0 ${ICON} ${ICON}`}
        style={{ flexShrink: 0, display: "block" }}
      >
        <defs>
          <clipPath id={clipId}>
            <circle cx={ICON / 2} cy={ICON / 2} r={ICON / 2} />
          </clipPath>
        </defs>
        <circle cx={ICON / 2} cy={ICON / 2} r={ICON / 2} fill={ink} fillOpacity={0.14} />
        <path
          ref={wave}
          d={wavePath(0, 0)}
          fill={ink}
          fillOpacity={0.24}
          clipPath={`url(#${clipId})`}
        />
        <path ref={head} d={headPath(0)} {...stroke} />
        <line ref={shaft} x1={ICON / 2} x2={ICON / 2} y1={12} y2={28} {...stroke} />
        <path
          ref={checkMark}
          d={CHECK_PATH}
          {...stroke}
          strokeDasharray={CHECK_LENGTH}
          strokeDashoffset={CHECK_LENGTH}
        />
      </svg>
    </Pressable>
  );
}
