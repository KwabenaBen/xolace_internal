/**
 * The Board's geometry, adapted from Native Cook's "Paddock Widget Bento" block. Sizes are points
 * on a 402-point-wide screen (the reference iPhone) and are multiplied by
 * `s = width / REFERENCE_WIDTH`. Colours and fonts live in src/components/ui/theme.ts.
 */
export const REFERENCE_WIDTH = 402;
/** Wider screens (web, iPad) keep the phone layout, centred, up to this width. */
export const MAX_BOARD_WIDTH = 520;

/** Spacing (points). Columns: 10 · 186 · 10 · 186 · 10, with a 12-point row rhythm. */
export const space = {
  screenInset: 10,
  columnGap: 10,
  rowGap: 12,
  tileInset: 16,
  tileTextAfterMark: 60.5,
  tileMarkCenter: 31,
  cardInset: 14.5,
  statsTextX: 85.3,
  statsCaptionX: 21.3,
  heroFirstX: 15.7,
  heroSecondX: 58.4,
  guideInset: 14.3,
} as const;

export const size = {
  column: 186,
  full: 382,
  quick: 62,
  tall: 210, // three quick tiles and two row gaps
  stats: 144,
  hero: 128,
  guide: 110,
  mark: 50, // the square icon tile on the tall card
  arrow: 18.5,
  seal: 40.5,
} as const;

export const radius = {
  quick: 31,
  card: 28,
  mark: 13.5,
  chip: 5.5,
  row: 18,
} as const;

export const type = {
  eyebrow: 12.5,
  eyebrowTracking: -0.3,
  tileTitle: 16.5,
  tileTitleTracking: -0.2,
  violet: 19.5,
  violetTracking: -0.9,
  badge: 13,
  tileIcon: 26,
  cardTitle: 32,
  cardSubtitle: 12.2,
  cardSmall: 10.2,
  statsEyebrow: 16,
  statsWord: 32.5,
  caption: 12,
  heroGlyph: 61,
  heroSeal: 13,
  guideTitle: 28.2,
  guideHelper: 12,
  pageTitle: 30,
} as const;

/** A press shrinks a tile to 97% (100 ms in, 180 ms out), as in the reference. */
export const press = { scale: 0.97, inMs: 100, outMs: 180 } as const;
