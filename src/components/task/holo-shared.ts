/**
 * Shared by holo-card.tsx (iOS/Android, Skia) and holo-card.web.tsx. Kept apart because on web
 * "./holo-card" resolves to the web file itself.
 */

/** Room round the native card for its tilt and shadow (points). */
export const HOLO_MARGIN = 26;

/** Card height for a given width: the reference's 1.6 aspect. */
export const holoCardHeight = (width: number): number => Math.round(width / 1.6);

export type HoloCardProps = {
  /** Card width in points. */
  width: number;
  /** The big chrome word, e.g. "IN PROGRESS". */
  word: string;
  /** Two short lines bottom-left, e.g. ["OWNED BY", "KOFI MENSAH"]. */
  footer: [string, string];
  /** Bottom-right label, e.g. "CODE". */
  corner: string;
  /** 0–1: a richer foil (used for verified tasks). */
  glow?: number;
  accessibilityLabel: string;
};
