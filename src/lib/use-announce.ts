import { useEffect } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Reads a message out with VoiceOver / TalkBack when it appears or changes (an error after a
 * save). `accessibilityRole="alert"` alone isn't read out on iOS.
 */
export function useAnnounce(message: string | null | undefined): void {
  useEffect(() => {
    if (message !== null && message !== undefined && message !== "") {
      AccessibilityInfo.announceForAccessibility(message);
    }
  }, [message]);
}
