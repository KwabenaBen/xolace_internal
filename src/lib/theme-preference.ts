import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { Uniwind, useUniwind } from "uniwind";

/**
 * Cadence's theme: black or off-white. Until someone flips Dark mode on the Settings screen it
 * follows the phone; after that the choice is kept on this device (the Keychain via
 * expo-secure-store, localStorage on web) and wins over the phone's setting. Uniwind applies it
 * everywhere: HeroUI, the bespoke screens (usePageColors) and, on iOS, the system's own controls.
 */

const KEY = "cadence.theme";
export type ThemeChoice = "light" | "dark";

async function readChoice(): Promise<ThemeChoice | null> {
  try {
    const stored =
      Platform.OS === "web"
        ? window.localStorage.getItem(KEY)
        : await SecureStore.getItemAsync(KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

async function writeChoice(choice: ThemeChoice): Promise<void> {
  try {
    if (Platform.OS === "web") window.localStorage.setItem(KEY, choice);
    else await SecureStore.setItemAsync(KEY, choice);
  } catch {
    // Storage unavailable (e.g. private browsing): the choice lasts until the app closes.
  }
}

/** At start-up, before the first screen: re-apply the theme chosen on this device, if any. */
export async function applySavedTheme(): Promise<void> {
  const choice = await readChoice();
  if (choice !== null) Uniwind.setTheme(choice);
}

/** The Dark mode switch: apply now, and remember it on this device. */
export function chooseTheme(choice: ThemeChoice): void {
  Uniwind.setTheme(choice);
  void writeChoice(choice);
}

/** True while Cadence shows its black theme (re-renders when it changes). */
export function useIsDarkTheme(): boolean {
  return useUniwind().theme === "dark";
}
