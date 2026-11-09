import { useSyncExternalStore } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/*
 Settings → Accessibility → Reduce Transparency (iOS), or `prefers-reduced-transparency` on the
 web: when it's on, overlays use a plain dim instead of a blur. Read once, then kept current by
 the system's change events; shared by every overlay.
*/

let reduce = false;
let started = false;
const listeners = new Set<() => void>();

function set(next: boolean) {
  if (next === reduce) return;
  reduce = next;
  for (const listener of listeners) listener();
}

function start() {
  if (started) return;
  started = true;
  if (Platform.OS === "web") {
    const query =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-transparency: reduce)")
        : null;
    if (query === null) return;
    set(query.matches);
    query.addEventListener("change", (e) => set(e.matches));
    return;
  }
  AccessibilityInfo.isReduceTransparencyEnabled()
    .then(set)
    .catch(() => {});
  AccessibilityInfo.addEventListener("reduceTransparencyChanged", set);
}

export function useReduceTransparency(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      start();
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    () => reduce,
    () => false
  );
}
