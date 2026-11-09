// Clay Relight Settings — the colours of the screen at noon, at sunset and at night, and its layout.
// Cadence: noon and night are the app's own themes (the off-white #FEFAF3 and black pages, the same
// panels and text as src/global.css), so the switch lands exactly on the app's real look; the sunset
// tones in between are the block's. Text is the app's Montserrat instead of the block's Inter.

/** Each token at noon, at sunset and at night. Noon → sunset follows the light (m); the step to night
 * is its own short fade (`theme`, see crs-motion). */
export const PALETTE = {
  page: ["#FEFAF3", "#F4E6DC", "#000000"],
  card: ["#F4EEE2", "#FBEDE2", "#141215"],
  ink: ["#000000", "#2B1E1A", "#FEFAF3"],
  mute: ["#6B665D", "#7A6058", "#A29E97"],
  line: ["#E2D9C7", "#EED9CC", "#262523"],
  trackOff: ["#E3DBCA", "#E9D6CB", "#29262B"],
  pill: ["rgba(254,250,243,0.72)", "rgba(255,244,235,0.72)", "rgba(0,0,0,0.55)"],
  pillInk: ["#000000", "#3A2620", "#FEFAF3"],
} as const;

export const TRACK_ON = "#5B5BD6";

/** Montserrat (loaded app-wide in the root layout), mapped onto the block's three weights. */
export const FONT = {
  regular: "Montserrat-Medium",
  medium: "Montserrat-SemiBold",
  semibold: "Montserrat-Bold",
  title: "Montserrat-Black",
} as const;

export const SPACE = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;

/** A row of the list: its title, the value on the right at day and at night, and where it goes. */
export type Row = {
  title: string;
  day: string;
  night: string;
  onPress?: () => void;
  hint?: string;
};

/** The icon shader draws exactly five rows (crs-icon-shader.ts): bell, crescent, people, shield,
 * padlock. */
export const ROW_COUNT = 5;

/** m → the time on the card's clock, in minutes after midnight (2:40 PM … 11:40 PM). */
export const CLOCK = { from: 14 * 60 + 40, span: 540 } as const;

export const SCENE_H = 232;
export const BAND_H = 76;
export const ROW_H = 60;
export const TILE = 40;
export const ICON_COL = 64;
export const SWITCH = { w: 51, h: 31, knob: 27 } as const;

export type Layout = {
  w: number;
  side: number;
  cardW: number;
  titleTop: number;
  heroTop: number;
  heroH: number;
  sectionTop: number;
  listTop: number;
  listH: number;
  /** The whole screen's height (it scrolls when it's taller than the window). */
  contentH: number;
};

export function makeLayout(w: number, top: number, bottom: number): Layout {
  const side = SPACE.l;
  const titleTop = top + SPACE.s;
  const heroTop = titleTop + 44 + SPACE.l;
  const heroH = SCENE_H + BAND_H;
  const sectionTop = heroTop + heroH + SPACE.xl;
  const listTop = sectionTop + 18 + SPACE.s;
  const listH = ROW_COUNT * ROW_H;
  return {
    w,
    side,
    cardW: w - 2 * side,
    titleTop,
    heroTop,
    heroH,
    sectionTop,
    listTop,
    listH,
    contentH: listTop + listH + SPACE.xl + bottom,
  };
}
