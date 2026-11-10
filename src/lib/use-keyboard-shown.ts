import { useSyncExternalStore } from "react";
import { Keyboard, Platform, type EmitterSubscription } from "react-native";

/**
 * Whether the on-screen keyboard is up, e.g. so a sheet drops its bottom safe-area padding while
 * it rises above the keyboard. iOS reports it as the keyboard starts to move; Android once it has.
 */
let shown = false;
const listeners = new Set<() => void>();
let subscriptions: EmitterSubscription[] = [];

function set(next: boolean) {
  if (shown === next) return;
  shown = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    const show = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hide = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    subscriptions = [
      Keyboard.addListener(show, () => set(true)),
      Keyboard.addListener(hide, () => set(false)),
    ];
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      for (const subscription of subscriptions) subscription.remove();
      subscriptions = [];
    }
  };
}

export function useKeyboardShown(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => shown,
    () => false
  );
}
