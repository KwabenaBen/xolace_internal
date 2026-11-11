import { fonts } from "@/components/ui/theme";

/**
 * The website layout's quiet look, after Notion: the system's own text font at small sizes,
 * Montserrat only for page titles and the wordmark, thin lines, and Cadence's sticker colours
 * only as accents (status and priority pills, the late red). Colours come from usePageColors, so
 * the Dark mode switch works here too.
 */
export const webFont =
  'Inter, "Segoe UI", -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif';

export const webType = {
  /** Page titles (Montserrat). */
  title: { fontFamily: fonts.extraBold, fontSize: 30, lineHeight: 38, letterSpacing: -0.6 },
  /** Section headings. */
  heading: { fontFamily: webFont, fontSize: 15, lineHeight: 22, fontWeight: "600" as const },
  /** Running text, table cells. */
  body: { fontFamily: webFont, fontSize: 14, lineHeight: 21 },
  /** Secondary lines, table headers. */
  small: { fontFamily: webFont, fontSize: 13, lineHeight: 19 },
  /** Labels, counts. */
  tiny: { fontFamily: webFont, fontSize: 12, lineHeight: 16 },
};

export const SIDEBAR_WIDTH = 248;
export const SIDEBAR_COLLAPSED_WIDTH = 64;
/** The widest a page's content gets (tables can use it all). */
export const PAGE_MAX_WIDTH = 1080;
