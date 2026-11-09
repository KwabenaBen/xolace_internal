import { Platform } from "react-native";

import type { TaskStatus } from "@convex/lib/validators";

/**
 * The Board's look, adapted from Native Cook's "Paddock Widget Bento" block: a black screen with
 * a bento of bold colour stickers in Montserrat. Sizes are points on a 402-point-wide screen
 * (the reference iPhone) and are multiplied by `s = width / REFERENCE_WIDTH`.
 */
export const REFERENCE_WIDTH = 402;
/** Wider screens (web, iPad) keep the phone layout, centred, up to this width. */
export const MAX_BOARD_WIDTH = 520;

/** Colours sampled from the reference. */
export const colors = {
  background: "#000000",
  violet: "rgb(50,33,252)",
  orange: "rgb(254,63,3)",
  yellow: "rgb(255,218,38)",
  cream: "rgb(242,238,223)",
  statsGlow: "rgb(42,40,40)",
  statsShade: "rgb(20,18,21)",
  green: "rgb(5,208,130)",
  blue: "rgb(62,157,255)",
  red: "rgb(247,26,33)",
  rose: "rgb(253,121,120)",
  guideYellow: "rgb(252,254,31)",
  micInk: "rgb(255,196,178)",
  white: "#FFFFFF",
  black: "#000000",
  ink55Black: "rgba(0,0,0,0.55)",
  ink75White: "rgba(255,255,255,0.75)",
  closeFill: "rgba(0,0,0,0.5)",
  sealStroke: "rgba(247,26,33,0.18)",
  secondary: "rgba(235,235,245,0.6)",
  panel08: "rgba(255,255,255,0.08)",
  panel12: "rgba(255,255,255,0.12)",
  hairline: "rgba(255,255,255,0.12)",
} as const;

/** Each task status gets one of the sticker colours, with readable ink on top. */
export const STATUS_COLORS: Record<TaskStatus, { fill: string; ink: string }> = {
  proposed: { fill: colors.rose, ink: colors.black },
  declined: { fill: colors.red, ink: colors.white },
  todo: { fill: colors.cream, ink: colors.black },
  in_progress: { fill: colors.blue, ink: colors.white },
  blocked: { fill: colors.red, ink: colors.white },
  in_peer_review: { fill: colors.violet, ink: colors.white },
  submitted: { fill: colors.orange, ink: colors.white },
  verified: { fill: colors.green, ink: colors.black },
  changes_requested: { fill: colors.yellow, ink: colors.black },
};

/** Montserrat (OFL, assets/fonts) as registered with expo-font in the root layout. */
export const BOARD_FONT_FILES = {
  "Montserrat-Medium": require("../../../assets/fonts/Montserrat-Medium.ttf"),
  "Montserrat-SemiBold": require("../../../assets/fonts/Montserrat-SemiBold.ttf"),
  "Montserrat-Bold": require("../../../assets/fonts/Montserrat-Bold.ttf"),
  "Montserrat-ExtraBold": require("../../../assets/fonts/Montserrat-ExtraBold.ttf"),
  "Montserrat-Black": require("../../../assets/fonts/Montserrat-Black.ttf"),
} as const;

export const fonts = {
  medium: "Montserrat-Medium",
  semibold: "Montserrat-SemiBold",
  bold: "Montserrat-Bold",
  extraBold: "Montserrat-ExtraBold",
  black: "Montserrat-Black",
  serif: Platform.select({ ios: "ui-serif", default: "serif" }),
} as const;

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
