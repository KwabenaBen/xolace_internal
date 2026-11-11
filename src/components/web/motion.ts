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
