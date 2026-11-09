import { useThemeColor } from "heroui-native";
import { Platform, useColorScheme } from "react-native";

import type { TaskStatus } from "@convex/lib/validators";

/**
 * Cadence's two themes, black and a warm off-white, following the phone's dark/light setting.
 * The values live once, in src/global.css (HeroUI's theme variables); bespoke screens read them
 * here so they always match the HeroUI screens. Coloured stickers (tiles, status pills, pastel
 * cards) don't change with the theme.
 */

/** The off-white Cadence uses instead of pure white. */
export const PAPER = "#FEFAF3";
export const INK = "#000000";

export type PageColors = {
  scheme: "dark" | "light";
  /** The page behind everything: black, or off-white. */
  page: string;
  /** Text on the page. */
  text: string;
  /** Quieter text on the page (dates, captions). */
  muted: string;
  /** Cards and panels on the page, and a step and two steps up for things inside them. */
  panel: string;
  panelRaised: string;
  panelHigh: string;
  /** Thin borders and dividers. */
  hairline: string;
  separator: string;
  /** Text inputs. */
  field: string;
  fieldText: string;
  placeholder: string;
  /** Primary pill buttons (off-white on black, black on off-white) and their text. */
  accent: string;
  accentText: string;
  /** Secondary pill buttons and their text. */
  secondary: string;
  secondaryText: string;
  danger: string;
  /** The status bar's content style on this page. */
  statusBar: "light" | "dark";
};

/** The current theme's page colours (re-renders when the phone switches dark/light). */
export function usePageColors(): PageColors {
  const scheme = useColorScheme() === "light" ? "light" : "dark";
  const [
    page,
    text,
    muted,
    panel,
    panelRaised,
    panelHigh,
    hairline,
    separator,
    field,
    fieldText,
    placeholder,
    accent,
    accentText,
    secondary,
    secondaryText,
    danger,
  ] = useThemeColor([
    "background",
    "foreground",
    "muted",
    "surface",
    "surface-secondary",
    "surface-tertiary",
    "border",
    "separator",
    "field",
    "field-foreground",
    "field-placeholder",
    "accent",
    "accent-foreground",
    "default",
    "default-foreground",
    "danger",
  ]);
  return {
    scheme,
    page,
    text,
    muted,
    panel,
    panelRaised,
    panelHigh,
    hairline,
    separator,
    field,
    fieldText,
    placeholder,
    accent,
    accentText,
    secondary,
    secondaryText,
    danger,
    statusBar: scheme === "dark" ? "light" : "dark",
  };
}

/**
 * The coloured stickers: the Board's tiles (after Native Cook's "Paddock Widget Bento"), status
 * pills, and the detail pages' pastel cards (after the team's fitness-app reference) and holo card
 * (after the "Holo Cash Card" block). They keep these colours in both themes, with their own
 * readable ink. `secondary`, `panel08`, `panel12` and `hairline` are for text and tracks ON the
 * dark Progress tile, not for the page (use `usePageColors` for the page).
 */
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
  // Detail pages: pastel cards, tags and stickers.
  lavender: "rgb(172,153,245)",
  lavenderStrong: "rgb(173,152,253)",
  peach: "rgb(254,189,89)",
  sky: "rgb(167,203,255)",
  pink: "rgb(255,161,255)",
  pill: "rgb(255,248,249)",
  pillBorder: "rgb(222,212,255)",
  magenta: "#e93ad8", // the holo block's rate tag
  sticker: "#f5ec3d", // the holo block's BOOST sticker
  tagFill: "rgba(255,255,255,0.72)",
  ink: "#111111", // black text on the pastels
  note: "#8a8a8f",
  holoCard: "#0b0b0d",
  lateCard: "#c2141b", // the late countdown card: deep enough for white text (5.9:1)
} as const;

/** Each task status gets one of the sticker colours, with ink that passes 4.5:1 on it. */
export const STATUS_COLORS: Record<TaskStatus, { fill: string; ink: string }> = {
  proposed: { fill: colors.rose, ink: colors.black },
  declined: { fill: colors.red, ink: colors.black },
  todo: { fill: colors.cream, ink: colors.black },
  in_progress: { fill: colors.blue, ink: colors.black },
  blocked: { fill: colors.red, ink: colors.black },
  in_peer_review: { fill: colors.violet, ink: colors.white },
  submitted: { fill: colors.orange, ink: colors.black },
  verified: { fill: colors.green, ink: colors.black },
  changes_requested: { fill: colors.yellow, ink: colors.black },
};

/**
 * The app's display fonts (OFL, assets/fonts), registered with expo-font in the root layout:
 * Montserrat for the Board and task page, Anton (condensed) for the task page's holo wordmark.
 */
export const FONT_FILES = {
  "Montserrat-Medium": require("../../../assets/fonts/Montserrat-Medium.ttf"),
  "Montserrat-SemiBold": require("../../../assets/fonts/Montserrat-SemiBold.ttf"),
  "Montserrat-Bold": require("../../../assets/fonts/Montserrat-Bold.ttf"),
  "Montserrat-ExtraBold": require("../../../assets/fonts/Montserrat-ExtraBold.ttf"),
  "Montserrat-Black": require("../../../assets/fonts/Montserrat-Black.ttf"),
  "Anton-Regular": require("../../../assets/fonts/Anton-Regular.ttf"),
} as const;

export const fonts = {
  medium: "Montserrat-Medium",
  semibold: "Montserrat-SemiBold",
  bold: "Montserrat-Bold",
  extraBold: "Montserrat-ExtraBold",
  black: "Montserrat-Black",
  condensed: "Anton-Regular",
  serif: Platform.select({ ios: "ui-serif", default: "serif" }),
} as const;
