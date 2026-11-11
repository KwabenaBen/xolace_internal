import { gsap } from "gsap";
import { useLayoutEffect, useRef, type RefObject } from "react";
import { useReducedMotion } from "react-native-reanimated";

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
  const reduceMotion = useReducedMotion();
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
