import { gsap } from "gsap";
import { useLayoutEffect, useRef, type RefObject } from "react";
import { useReducedMotion } from "react-native-reanimated";

/**
 * For now the website plays its motion in full even when the computer asks for reduced motion
 * (Windows "Animation effects" off, the Mac's "Reduce motion" on): the team asked to see and
 * judge every animation first (11 Nov). Set this back to `true` before release (Phase 7), so
 * Reduce Motion switches the sidebar, the cards and the buttons instantly again.
 */
export const RESPECT_REDUCE_MOTION_ON_WEB = false;

/** The website's Reduce Motion: the computer's setting, unless switched off above. */
export function useWebReducedMotion(): boolean {
  const reduceMotion = useReducedMotion();
  return RESPECT_REDUCE_MOTION_ON_WEB && reduceMotion;
}

/** Same as motion.ts's (the app's no-op version). */
type LiftOptions = {
  y?: number;
  shadow?: { rest: string; lifted: string };
};

/**
 * Lifts a card while it's hovered or focused: it rises a few pixels and its shadow grows, eased
 * with GSAP (out quickly, back softly). GSAP owns the card's `transform` and `box-shadow` from
 * then on, so the card's own style must not set them. Reduce Motion: only the shadow changes, at
 * once.
 */
export function useHoverLift(
  ref: RefObject<unknown>,
  active: boolean,
  { y = -4, shadow }: LiftOptions = {}
): void {
  const reduceMotion = useWebReducedMotion();
  // The state last put on screen; null until the first one (which is instant).
  const shown = useRef<boolean | null>(null);

  useLayoutEffect(() => {
    const card = ref.current as HTMLElement | null;
    if (card === null || shown.current === active) return;
    const instant = shown.current === null || reduceMotion;
    shown.current = active;
    const vars: gsap.TweenVars = {
      y: active && !reduceMotion ? y : 0,
      ...(shadow !== undefined ? { boxShadow: active ? shadow.lifted : shadow.rest } : {}),
    };
    if (instant) gsap.set(card, vars);
    else {
      gsap.to(card, {
        ...vars,
        duration: active ? 0.3 : 0.45,
        ease: active ? "power3.out" : "power2.out",
        overwrite: "auto",
      });
    }
  });

  // Stop any lift still running when the card goes away.
  useLayoutEffect(() => {
    const card = ref.current as HTMLElement | null;
    return () => {
      if (card !== null) gsap.killTweensOf(card);
    };
  }, [ref]);
}

type TweenValues = Record<string, number | string>;

/**
 * Eases an element to `values` whenever they change, from wherever it is (so a quick change
 * mid-way turns around smoothly); the first time it just sets them. GSAP then owns those styles.
 */
export function useTweenTo(ref: RefObject<unknown>, values: TweenValues, duration = 0.32): void {
  const reduceMotion = useWebReducedMotion();
  const key = JSON.stringify(values);
  const shown = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = ref.current as HTMLElement | null;
    if (el === null || shown.current === key) return;
    const instant = shown.current === null || reduceMotion;
    shown.current = key;
    if (instant) gsap.set(el, values);
    else gsap.to(el, { ...values, duration, ease: "power3.out", overwrite: "auto" });
  });

  useLayoutEffect(() => {
    const el = ref.current as HTMLElement | null;
    return () => {
      if (el !== null) gsap.killTweensOf(el);
    };
  }, [ref]);
}

/** Grows an element in from its left edge when it first appears (a progress bar filling up). */
export function useGrowIn(ref: RefObject<unknown>, delay = 0): void {
  const reduceMotion = useWebReducedMotion();
  useLayoutEffect(() => {
    const el = ref.current as HTMLElement | null;
    if (el === null || reduceMotion) return;
    const tween = gsap.from(el, {
      scaleX: 0,
      transformOrigin: "0% 50%",
      duration: 0.9,
      delay,
      ease: "power3.out",
    });
    return () => {
      tween.revert();
    };
  }, [ref, delay, reduceMotion]);
}

/** Press feedback: the element sinks a little while pressed and springs back when let go. */
export function usePressScale(ref: RefObject<unknown>): {
  onPressIn?: () => void;
  onPressOut?: () => void;
} {
  const reduceMotion = useWebReducedMotion();
  const to = (scale: number, duration: number, ease: string) => {
    const el = ref.current as HTMLElement | null;
    if (el === null || reduceMotion) return;
    gsap.to(el, { scale, duration, ease, overwrite: "auto" });
  };
  return {
    onPressIn: () => to(0.96, 0.12, "power2.out"),
    onPressOut: () => to(1, 0.45, "elastic.out(1, 0.5)"),
  };
}

/** Plays an element in from `from` (e.g. off to the right, transparent) when it first appears. */
export function useEnterFrom(ref: RefObject<unknown>, from: TweenValues, duration = 0.5): void {
  const reduceMotion = useWebReducedMotion();
  const fromKey = JSON.stringify(from);
  useLayoutEffect(() => {
    const el = ref.current as HTMLElement | null;
    if (el === null || reduceMotion) return;
    const tween = gsap.from(el, {
      ...(JSON.parse(fromKey) as TweenValues),
      duration,
      ease: "power3.out",
    });
    return () => {
      tween.revert();
    };
  }, [ref, fromKey, duration, reduceMotion]);
}

/** Plays elements out to `to`, then resolves (e.g. before closing a panel). */
export function playOut(
  targets: RefObject<unknown>[],
  to: TweenValues,
  duration = 0.3
): Promise<void> {
  const els = targets.map((t) => t.current as HTMLElement | null).filter((el) => el !== null);
  if (
    els.length === 0 ||
    (RESPECT_REDUCE_MOTION_ON_WEB && matchMedia("(prefers-reduced-motion: reduce)").matches)
  ) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    gsap.to(els, {
      ...to,
      duration,
      ease: "power2.in",
      overwrite: "auto",
      onComplete: () => resolve(),
    });
  });
}
