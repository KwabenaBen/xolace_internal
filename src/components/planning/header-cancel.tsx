import { router } from "expo-router";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { Pressable } from "react-native";

import { Sym, symbols } from "@/components/ui/sym";

/**
 * The ✕ at the top left of every form modal (the website's dialogs draw their own). Closing goes
 * through the form's unsaved-changes guard (useUnsavedGuard), so edits are never lost without
 * asking.
 */
export function HeaderCancel(): JSX.Element {
  const foreground = useThemeColor("foreground");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={10}
      onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
      className="active:opacity-60"
    >
      <Sym symbol={symbols.close} size={20} color={foreground} weight="semibold" />
    </Pressable>
  );
}
