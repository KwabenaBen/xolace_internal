/**
 * The save button's icon, after the team's "Download buttons" reference: an arrow in a disc that
 * collapses as you press (its head flattens to a line and fades, its shaft drops to a short tick),
 * then the disc fills with liquid rising on a wavy surface (the tick riding it) while it saves, and
 * a check draws in once it's done. All in a 40×40 box. Shared by the phone (save-button.tsx,
 * Reanimated) and the website (save-button.web.tsx, GSAP): plain worklet functions of a few
 * numbers, defined before anything that calls them.
 */

/** The button's props, the same on the phone and the website. */
export type SaveButtonProps = {
  /** The words as it goes: e.g. "Save log", "Saving", "Saved". */
  labels: { idle: string; busy: string; done: string };
  /** Checked before anything moves: false (e.g. a required field is empty) keeps it at rest. */
  validate?: () => boolean;
  /** The save itself: true once saved, false if it failed (the form shows why). */
  onPress: () => Promise<boolean>;
  /** After "Saved" and its check have shown (e.g. close the form). */
  onDone?: () => void;
  isDisabled?: boolean;
};

export const ICON = 40;
/** The check's stroke length, for drawing it in with a dash offset. */
export const CHECK_LENGTH = 23;
export const CHECK_PATH = "M12.5 20.5 L17.5 25.5 L27.5 15";

/** Where the liquid's surface sits for a fill `level` (0 empty, 1 over the top). */
export function surfaceY(level: number): number {
  "worklet";
  return ICON - level * (ICON + 4);
}

/**
 * The liquid: a band whose top is a wave, `phase` (0–1, looping) sliding it sideways. Flat when
 * empty or full, so nothing shows at rest.
 */
export function wavePath(level: number, phase: number): string {
  "worklet";
  const y = surfaceY(level);
  const length = 20;
  const amplitude = level <= 0.02 || level >= 0.98 ? 0 : 2.4;
  const start = -length * 2 + phase * length;
  let d = `M ${start} ${y}`;
  for (let x = start; x < ICON + length; x += length) {
    d += ` q ${length / 4} ${-amplitude} ${length / 2} 0 t ${length / 2} 0`;
  }
  return `${d} L ${ICON + length * 2} ${ICON + 2} L ${start} ${ICON + 2} Z`;
}

/** The arrow's head, from "^" (`flat` 0) to a flat line (1), bowing a little on the way. */
export function headPath(flat: number): string {
  "worklet";
  const ends = 19 - 7 * flat;
  const middle = 12 + 2 * Math.sin(Math.PI * flat);
  return `M 13 ${ends} L 20 ${middle} L 27 ${ends}`;
}

/**
 * The arrow's shaft: the full line at rest (`drop` 0), a short tick once dropped (1), the tick
 * riding just above the liquid's surface.
 */
export function shaftEnds(drop: number, level: number): { y1: number; y2: number } {
  "worklet";
  const tickTop = Math.max(6, Math.min(32, surfaceY(level) - 7));
  return {
    y1: 12 + (tickTop - 12) * drop,
    y2: 28 + (tickTop + 4 - 28) * drop,
  };
}
