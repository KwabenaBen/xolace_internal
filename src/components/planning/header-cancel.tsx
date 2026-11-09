import { router } from "expo-router";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { Pressable, Text } from "react-native";

/**
 * "Cancel" at the top left of the form modals. Closing goes through the form's unsaved-changes
 * guard (useUnsavedGuard), so edits are never lost without asking.
 */
export function HeaderCancel(): JSX.Element {
  const foreground = useThemeColor("foreground");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Cancel"
      hitSlop={10}
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      className="active:opacity-60"
    >
      <Text style={{ fontSize: 17, color: foreground }}>Cancel</Text>
    </Pressable>
  );
}
