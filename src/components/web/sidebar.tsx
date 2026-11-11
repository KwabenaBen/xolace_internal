import type { JSX } from "react";

/**
 * The website layout's sidebar only exists on the web (sidebar.web.tsx, animated with GSAP). The
 * iPhone app never shows it, so this stub keeps GSAP out of the app's bundle.
 */
export function Sidebar(): JSX.Element | null {
  return null;
}
