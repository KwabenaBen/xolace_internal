import type { RefObject } from "react";

/** How a card lifts while it's hovered or focused (the website layout's motion, motion.web.ts). */
export type LiftOptions = {
  /** How far it rises, in px (negative is up). */
  y?: number;
  /** Its shadow at rest and lifted (CSS box-shadow, the same shape so it can blend). */
  shadow?: { rest: string; lifted: string };
};

/**
 * Lifts a card while `active`. Only the website layout animates (motion.web.ts, with GSAP); the
 * app has no hover, so here it does nothing and GSAP stays out of the app's bundle.
 */
export function useHoverLift(
  _ref: RefObject<unknown>,
  _active: boolean,
  _options?: LiftOptions
): void {}

/**
 * Whether the website layout should hold back its motion (motion.web.ts has the real one, switched
 * off for now). Only website code calls it; the app keeps React Native's own `useReducedMotion`.
 */
export function useWebReducedMotion(): boolean {
  return false;
}

/** Style values a website element eases to (motion.web.ts): numbers (px, opacity) or strings. */
export type TweenValues = Record<string, number | string>;

/**
 * Eases an element to `values` whenever they change (the first time, it just sets them): a
 * hover wash fading in, a tab highlight sliding under the chosen tab. Website only.
 */
export function useTweenTo(
  _ref: RefObject<unknown>,
  _values: TweenValues,
  _duration?: number
): void {}

/** Grows an element in from its left edge when it first appears (a progress bar). Website only. */
export function useGrowIn(_ref: RefObject<unknown>, _delay?: number): void {}

/** Press feedback: the element sinks a little while pressed. Website only (the app: no handlers). */
export function usePressScale(_ref: RefObject<unknown>): {
  onPressIn?: () => void;
  onPressOut?: () => void;
} {
  return {};
}

/** Plays an element in from `from` (e.g. off to the right, transparent) when it first appears. Website only. */
export function useEnterFrom(
  _ref: RefObject<unknown>,
  _from: TweenValues,
  _duration?: number
): void {}

/** Plays elements out to `to`, then resolves (e.g. before closing a panel). The app: at once. */
export function playOut(
  _targets: RefObject<unknown>[],
  _to: TweenValues,
  _duration?: number
): Promise<void> {
  return Promise.resolve();
}
