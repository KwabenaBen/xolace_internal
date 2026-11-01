import { useNetworkState } from "expo-network";
import type { JSX, ReactNode } from "react";
import { Text, View } from "react-native";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";

/** True only when the device reports no connection (unknown counts as online). */
export function useIsOffline(): boolean {
  const { isConnected, isInternetReachable } = useNetworkState();
  return isConnected === false || isInternetReachable === false;
}

/**
 * Wraps the app. While offline it shows a banner across the top and hands the top
 * safe-area inset to the banner, so screens below don't leave a double gap.
 * Cadence is online-only (docs/REQUIREMENTS.md), so the banner says changes won't save.
 */
export function OfflineBanner({ children }: { children: ReactNode }): JSX.Element {
  const isOffline = useIsOffline();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background">
      {isOffline ? (
        <View
          className="bg-warning px-4 pb-2"
          style={{ paddingTop: insets.top + 8 }}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Text className="text-center text-sm font-medium text-warning-foreground">
            You&apos;re offline. Changes won&apos;t save until you reconnect.
          </Text>
        </View>
      ) : null}
      <SafeAreaInsetsContext.Provider value={isOffline ? { ...insets, top: 0 } : insets}>
        {children}
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}
