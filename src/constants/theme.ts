/**
 * Cadence design tokens for use from JS.
 *
 * - Colours come from HeroUI Native's theme (light + dark, see src/global.css). In markup
 *   use Tailwind classes (`bg-background`, `text-muted`, ...); in JS use
 *   `useThemeColor("accent")` from heroui-native.
 * - Spacing and type in markup use Tailwind classes; the values below are for the few
 *   places that need numbers (style props, navigation options).
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const layout = {
  /** Screens stop growing past this width so forms stay readable on desktop web. */
  maxContentWidth: 720,
  tabIconSize: 24,
} as const;

/** Semantic text styles, mapped onto HeroUI Typography types. */
export const typography = {
  screenTitle: "h2",
  sectionTitle: "h5",
  body: "body",
  caption: "body-sm",
} as const;
