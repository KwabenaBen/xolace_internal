import { Platform, useWindowDimensions } from "react-native";

/** From this width a browser window gets the website layout (sidebar, wide pages, dialogs). */
export const DESKTOP_MIN_WIDTH = 1000;

/**
 * The web on a wide window: the website layout (src/components/web/), after Notion. Phones, the
 * iPhone app and narrow browser windows keep the phone design.
 */
export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === "web" && width >= DESKTOP_MIN_WIDTH;
}
