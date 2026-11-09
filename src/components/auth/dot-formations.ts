/**
 * The welcome screen's dot field: a fixed set of dots that keeps moving between four
 * formations — a loose cloud, a swirling grid, a dense square and the word "cadence" — on a
 * loop. Everything here is a pure function of (dot index, time in seconds), marked "worklet"
 * so the iOS version can run it on the UI thread (Skia + Reanimated) and the web version can
 * run it on a canvas. Coordinates are in "units": the word spans x ∈ [-1, 1].
 */

// 5×7 dot-matrix glyphs, top row first. "#" is a dot.
const GLYPHS: Record<string, readonly string[]> = {
  c: [".....", ".....", ".###.", "#....", "#....", "#....", ".###."],
  a: [".....", ".....", ".###.", "....#", ".####", "#...#", ".####"],
  d: ["....#", "....#", ".####", "#...#", "#...#", "#...#", ".####"],
  e: [".....", ".....", ".###.", "#...#", "#####", "#....", ".###."],
  n: [".....", ".....", "####.", "#...#", "#...#", "#...#", "#...#"],
};

export const WORD = "cadence";
const GLYPH_WIDTH = 5;
const GLYPH_HEIGHT = 7;
const LETTER_GAP = 1;
const WORD_COLUMNS = WORD.length * GLYPH_WIDTH + (WORD.length - 1) * LETTER_GAP;

/** Lit cells of the word on its 41×7 glyph grid, left to right. */
export function wordCells(): { col: number; row: number }[] {
  const cells: { col: number; row: number }[] = [];
  for (let col = 0; col < WORD_COLUMNS; col++) {
    const letterIndex = Math.floor(col / (GLYPH_WIDTH + LETTER_GAP));
    const glyphCol = col % (GLYPH_WIDTH + LETTER_GAP);
    if (glyphCol >= GLYPH_WIDTH) continue;
    const glyph = GLYPHS[WORD[letterIndex]];
    for (let row = 0; row < GLYPH_HEIGHT; row++) {
      if (glyph[row][glyphCol] === "#") cells.push({ col, row });
    }
  }
  return cells;
}

export const WORD_GRID = { columns: WORD_COLUMNS, rows: GLYPH_HEIGHT };

// In the animation each glyph cell is drawn as a 2×2 block of dots, so the word reads as bold.
const SUB = 2;
const UNIT = 1 / ((WORD_COLUMNS * SUB - 1) / 2); // spacing between neighbouring word dots

function seededRandom(seed: number): () => number {
  // mulberry32: deterministic, so the cloud looks the same on every load.
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildFormations() {
  // Word: every 2×2 sub-dot of every lit cell, ordered left to right so morphs flow sideways.
  const wordX: number[] = [];
  const wordY: number[] = [];
  const cells = wordCells();
  for (const { col, row } of cells) {
    for (let sx = 0; sx < SUB; sx++) {
      for (let sy = 0; sy < SUB; sy++) {
        wordX.push((col * SUB + sx) * UNIT - 1);
        wordY.push((row * SUB + sy - (GLYPH_HEIGHT * SUB - 1) / 2) * UNIT);
      }
    }
  }
  const count = wordX.length;

  // Grid: column-major, so the left of the grid becomes the left of the word.
  const rows = 16;
  const columns = Math.ceil(count / rows);
  const spacing = 1.4 / (columns - 1);
  const gridX: number[] = [];
  const gridY: number[] = [];
  for (let i = 0; i < count; i++) {
    gridX.push((Math.floor(i / rows) - (columns - 1) / 2) * spacing);
    gridY.push(((i % rows) - (rows - 1) / 2) * spacing);
  }

  const random = seededRandom(7);
  const gaussian = () => (random() + random() + random() - 1.5) / 1.5; // ≈ N(0, 0.33²)
  const cloudX: number[] = [];
  const cloudY: number[] = [];
  const squareX: number[] = [];
  const squareY: number[] = [];
  const delay: number[] = [];
  for (let i = 0; i < count; i++) {
    const y = gaussian() * 0.75;
    cloudX.push(Math.max(-0.95, Math.min(0.95, gaussian() * 1.1 + y * 0.35)));
    cloudY.push(Math.max(-0.7, Math.min(0.7, y)));
    squareX.push(gridX[i] * 0.36 + (random() - 0.5) * 0.03);
    squareY.push(gridY[i] * 0.36 + (random() - 0.5) * 0.03);
    // Dots set off in a left-to-right wave with some scatter.
    delay.push(0.25 * ((gridX[i] / 0.7 + 1) / 2) + 0.1 * random());
  }

  return { count, wordX, wordY, gridX, gridY, cloudX, cloudY, squareX, squareY, delay };
}

const F = buildFormations();

export const DOT_COUNT = F.count;
const WORD_X = F.wordX;
const WORD_Y = F.wordY;
const GRID_X = F.gridX;
const GRID_Y = F.gridY;
const CLOUD_X = F.cloudX;
const CLOUD_Y = F.cloudY;
const SQUARE_X = F.squareX;
const SQUARE_Y = F.squareY;
const DELAY = F.delay;
const MAX_DELAY = 0.35;

// Formations: 0 cloud, 1 swirling grid, 2 dense square, 3 word.
const CLOUD = 0;
const GRID = 1;
const SQUARE = 2;
const WORD_FORMATION = 3;

// [from, to, seconds]; from === to is a hold.
const SEGMENTS: readonly (readonly [number, number, number])[] = [
  [CLOUD, CLOUD, 1.4],
  [CLOUD, GRID, 2.0],
  [GRID, GRID, 2.0],
  [GRID, SQUARE, 1.2],
  [SQUARE, SQUARE, 0.8],
  [SQUARE, WORD_FORMATION, 1.8],
  [WORD_FORMATION, WORD_FORMATION, 3.2],
  [WORD_FORMATION, CLOUD, 1.6],
];
const LOOP_SECONDS = SEGMENTS.reduce((sum, segment) => sum + segment[2], 0);

/** A moment in the loop when the word is fully formed (used when motion is reduced). */
export const WORD_HOLD_TIME = SEGMENTS.slice(0, 6).reduce((sum, s) => sum + s[2], 0) + 1.6;

// Worklet functions below must each be defined before any worklet that calls them: the worklets
// Babel plugin turns them into `const`s that capture their dependencies when defined, so a
// forward reference throws "Cannot access … before initialization" at load time.

function easeInOutCubic(x: number): number {
  "worklet";
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** A vortex: dots near the centre turn further than dots at the edge. */
function swirlAngle(x: number, y: number, t: number): number {
  "worklet";
  const falloff = Math.max(0, 1 - Math.sqrt(x * x + y * y) / 1.0);
  return 2.6 * Math.sin(t * 0.9) * falloff;
}

function formationX(formation: number, i: number, t: number): number {
  "worklet";
  if (formation === WORD_FORMATION) return WORD_X[i];
  if (formation === SQUARE) {
    const a = 0.25 * Math.sin(t * 0.7);
    return SQUARE_X[i] * Math.cos(a) - SQUARE_Y[i] * Math.sin(a);
  }
  if (formation === GRID) {
    const x = GRID_X[i];
    const y = GRID_Y[i];
    const a = swirlAngle(x, y, t);
    return x * Math.cos(a) - y * Math.sin(a);
  }
  const a = 0.18 * Math.sin(t * 0.35);
  return CLOUD_X[i] * Math.cos(a) - CLOUD_Y[i] * Math.sin(a);
}

function formationY(formation: number, i: number, t: number): number {
  "worklet";
  if (formation === WORD_FORMATION) return WORD_Y[i];
  if (formation === SQUARE) {
    const a = 0.25 * Math.sin(t * 0.7);
    return SQUARE_X[i] * Math.sin(a) + SQUARE_Y[i] * Math.cos(a);
  }
  if (formation === GRID) {
    const x = GRID_X[i];
    const y = GRID_Y[i];
    const a = swirlAngle(x, y, t);
    return x * Math.sin(a) + y * Math.cos(a);
  }
  const a = 0.18 * Math.sin(t * 0.35);
  return CLOUD_X[i] * Math.sin(a) + CLOUD_Y[i] * Math.cos(a);
}

/**
 * Position of dot `i` at `t` seconds, in units (word spans x ∈ [-1, 1]).
 * Returns [x, y].
 */
export function dotPosition(i: number, t: number): [number, number] {
  "worklet";
  let local = t % LOOP_SECONDS;
  let segment = SEGMENTS[0];
  for (let s = 0; s < SEGMENTS.length; s++) {
    segment = SEGMENTS[s];
    if (local < segment[2] || s === SEGMENTS.length - 1) break;
    local -= segment[2];
  }
  const from = segment[0];
  const to = segment[1];

  let x: number;
  let y: number;
  let wordness = from === WORD_FORMATION ? 1 : 0;
  if (from === to) {
    x = formationX(from, i, t);
    y = formationY(from, i, t);
  } else {
    const progress = Math.min(1, local / segment[2]);
    const q = Math.max(0, Math.min(1, (progress - DELAY[i]) / (1 - MAX_DELAY)));
    const e = easeInOutCubic(q);
    x = formationX(from, i, t) * (1 - e) + formationX(to, i, t) * e;
    y = formationY(from, i, t) * (1 - e) + formationY(to, i, t) * e;
    wordness = to === WORD_FORMATION ? e : from === WORD_FORMATION ? 1 - e : 0;
  }

  // A gentle shimmer that settles down while the word is readable.
  const wobble = 0.003 + 0.009 * (1 - wordness);
  x += wobble * Math.sin(t * 1.3 + i * 0.7);
  y += wobble * Math.cos(t * 1.1 + i * 1.3);
  return [x, y];
}

/** Height of the field relative to its width. */
export const DOT_FIELD_ASPECT = 0.78;
/** Pixels per unit: the word spans 90% of the field's width. */
export function dotFieldScale(width: number): number {
  return width * 0.45;
}
/** Dot radius in pixels, so dots stay distinct at any width. */
export function dotRadius(width: number): number {
  return Math.max(0.9, width / 270);
}
