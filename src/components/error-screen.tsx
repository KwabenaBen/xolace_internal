import { router, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { JSX } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PillButton } from "@/components/ui/pill-button";
import { fonts, usePageColors } from "@/components/ui/theme";
import { getErrorMessage } from "@/lib/errors";

/**
 * What the signed-in area shows when a screen throws (a failed query, a broken link), in place
 * of a blank or frozen screen: what happened, Try again, and a way back to the Board. Used as
 * the `ErrorBoundary` of src/app/(app)/_layout.tsx. In the theme's page colours.
 */
export function ErrorScreen({ error, retry }: ErrorBoundaryProps): JSX.Element {
  const insets = useSafeAreaInsets();
  const c = usePageColors();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.page,
        paddingTop: insets.top + 48,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 24,
        justifyContent: "space-between",
      }}
    >
      <StatusBar style={c.statusBar} />
      <View style={{ gap: 12 }}>
        <Text
          accessibilityRole="header"
          style={{ fontFamily: fonts.black, fontSize: 32, letterSpacing: -1, color: c.text }}
        >
          Something went wrong
        </Text>
        <Text
          style={{
            fontFamily: fonts.medium,
            fontSize: 16,
            lineHeight: 23,
            color: c.muted,
          }}
        >
          {getErrorMessage(error, "This screen couldn't load. Try again, or go back to the Board.")}
        </Text>
      </View>
      <View style={{ gap: 12 }}>
        <PillButton label="Try again" variant="secondary" onPress={() => void retry()} />
        <PillButton label="Back to the Board" onPress={() => router.replace("/")} />
      </View>
    </View>
  );
}
