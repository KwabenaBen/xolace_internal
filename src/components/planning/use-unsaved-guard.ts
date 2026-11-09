import { usePreventRemove } from "expo-router";
import { useState } from "react";
import { Alert, Platform } from "react-native";

/**
 * Asks before a form with changes is closed: the back button, Cancel, or the iOS swipe-down.
 * Call `markSaving()` just before saving, so the form can close once the save succeeds, and
 * `markFailed()` if it failed, so the guard is back on.
 */
export function useUnsavedGuard<T>(
  initial: T,
  values: T
): { markSaving: () => void; markFailed: () => void } {
  const [baseline] = useState(() => JSON.stringify(initial));
  const [isSaving, setIsSaving] = useState(false);
  const [isDiscarded, setIsDiscarded] = useState(false);
  const isDirty = JSON.stringify(values) !== baseline;

  usePreventRemove(isDirty && !isSaving && !isDiscarded, ({ repeat }) =>
    confirmDiscard(() => {
      setIsDiscarded(true);
      repeat();
    })
  );

  return { markSaving: () => setIsSaving(true), markFailed: () => setIsSaving(false) };
}

function confirmDiscard(discard: () => void): void {
  if (Platform.OS === "web") {
    if (window.confirm("Discard your changes?")) discard();
    return;
  }
  Alert.alert("Discard changes?", "What you've entered here will be lost.", [
    { text: "Keep editing", style: "cancel" },
    { text: "Discard", style: "destructive", onPress: discard },
  ]);
}
