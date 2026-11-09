/**
 * The pit stop, from the reference's motion model: the bento braces, every tile is flung off to
 * its own side, and the crew slams them back one by one, each on its own launched spring (2 %
 * overshoot), stretched along its travel by its speed and squashed by the stop. It plays when the
 * Board first appears (from the point where the tiles are off-screen) and when the feed is pulled
 * down past its top. Units: seconds and reference points.
 *
 * Worklets below may only call worklets defined above them (see CLAUDE.md → Worklets).
 */

/** Tiles in reading order. */
export const TILE = {
  dueSoon: 0,
  overdue: 1,
  waiting: 2,
  nextUp: 3,
  progress: 4,
  myTasks: 5,
  action: 6,
  hero: 7,
  guide: 8,
} as const;

export const PIT = {
  brace: 0.14,
  braceScale: 0.965,
  exit: 0.24,
  exitPower: 2.2,
  gap: 0.1,
  /** Arrival spring: natural frequency (rad/s), damping ratio, launch speed (× omega × distance). */
  omega: 17,
  zeta: 0.85,
  launch: 0.9,
  settle: 0.62,
  /** A tile leaves and returns this far beyond the screen edge. */
  margin: 46,
  width: [186, 186, 186, 186, 382, 186, 186, 382, 382],
  delay: [0, 0.07, 0.14, 0.03, 0.1, 0.19, 0.21, 0.27, 0.33],
  side: [-1, -1, -1, 1, 1, -1, 1, -1, 1],
  rise: [-26, 0, 22, -34, 10, 16, -16, 24, -20],
  tilt: [-6, -5, -6, 5, 3, -5, 5, -3, 3],
  stretchPerSpeed: 1 / 22000,
  maxStretch: 0.18,
  squashPerAccel: 1 / 700000,
  maxSquash: 0.08,
} as const;

/** When tiles start arriving; the Board's first appearance starts the pit stop here. */
export const PIT_ARRIVE = PIT.brace + PIT.exit + PIT.gap;
export const PIT_DURATION = PIT_ARRIVE + Math.max(...PIT.delay) + PIT.settle;
/** Pull the feed this far past its top (points) and let go to run the pit stop. */
export const PULL_TRIGGER = 72;

export type TilePose = { x: number; y: number; sx: number; sy: number; rotate: number };
const REST: TilePose = { x: 0, y: 0, sx: 1, sy: 1, rotate: 0 };

function clamp01(value: number): number {
  "worklet";
  return Math.min(1, Math.max(0, value));
}

function easeOut(value: number): number {
  "worklet";
  const t = clamp01(value);
  return 1 - (1 - t) * (1 - t) * (1 - t);
}

/** Launched spring from 1 to 0 (normalised displacement): [position, velocity, acceleration]. */
function launchedSpring(tau: number): [number, number, number] {
  "worklet";
  const w = PIT.omega;
  const z = PIT.zeta;
  const wd = w * Math.sqrt(1 - z * z);
  const b = (-PIT.launch * w + z * w) / wd;
  const e = Math.exp(-z * w * tau);
  const c = Math.cos(wd * tau);
  const s = Math.sin(wd * tau);
  const f = c + b * s;
  const df = wd * (-s + b * c);
  return [e * f, e * (df - z * w * f), e * ((z * z * w * w - wd * wd) * f - 2 * z * w * df)];
}

/**
 * Pose of tile `index` at `t` seconds into the pit stop (at rest outside 0…PIT_DURATION):
 * offset in points, scale along x (travel) and y, rotation in degrees.
 */
export function pitTile(index: number, t: number): TilePose {
  "worklet";
  if (t < 0 || t >= PIT_DURATION) return REST;
  const dx = PIT.side[index] * (PIT.width[index] + PIT.margin);
  const dy = PIT.rise[index];
  const tilt = PIT.tilt[index];
  if (t < PIT.brace) {
    const b = 1 - (1 - PIT.braceScale) * easeOut(t / PIT.brace);
    return { x: 0, y: 0, sx: b, sy: b, rotate: 0 };
  }
  if (t < PIT.brace + PIT.exit) {
    const e = (t - PIT.brace) / PIT.exit;
    const f = Math.pow(e, PIT.exitPower);
    const speed = (Math.abs(dx) * PIT.exitPower * Math.pow(e, PIT.exitPower - 1)) / PIT.exit;
    const stretch = 1 + Math.min(PIT.maxStretch, speed * PIT.stretchPerSpeed);
    return {
      x: dx * f,
      y: dy * f,
      sx: PIT.braceScale * stretch,
      sy: PIT.braceScale / Math.sqrt(stretch),
      rotate: tilt * f,
    };
  }
  const tau = t - PIT_ARRIVE - PIT.delay[index];
  if (tau < 0) return { x: dx, y: dy, sx: 1, sy: 1, rotate: tilt };
  const state = launchedSpring(tau);
  const speed = Math.abs(dx * state[1]);
  const stretch = Math.min(PIT.maxStretch, speed * PIT.stretchPerSpeed);
  const squash =
    state[0] < 0 ? Math.min(PIT.maxSquash, Math.abs(dx * state[2]) * PIT.squashPerAccel) : 0;
  const along = 1 + stretch - squash;
  return {
    x: dx * state[0],
    y: dy * state[0],
    sx: along,
    sy: 1 / Math.sqrt(along),
    rotate: tilt * state[0],
  };
}
