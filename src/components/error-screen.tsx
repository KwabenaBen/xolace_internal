import { router, type ErrorBoundaryProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { JSX } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PillButton } from "@/components/auth/pill-button";
import { colors, fonts } from "@/components/board/board-theme";
import { getErrorMessage } from "@/lib/errors";

/**
 * What the signed-in area shows when a screen throws (a failed query, a broken link), in place
 * of a blank or frozen screen: what happened, Try again, and a way back to the Board. Used as
 * the `ErrorBoundary` of src/app/(app)/_layout.tsx. Black, like the Board.
 */
export function ErrorScreen({ error, retry }: ErrorBoundaryProps): JSX.Element {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: insets.top + 48,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 24,
        justifyContent: "space-between",
      }}
    >
      <StatusBar style="light" />
      <View style={{ gap: 12 }}>
        <Text
          accessibilityRole="header"
          style={{ fontFamily: fonts.black, fontSize: 32, letterSpacing: -1, color: colors.white }}
        >
          Something went wrong
        </Text>
        <Text
          style={{
            fontFamily: fonts.medium,
            fontSize: 16,
            lineHeight: 23,
            color: colors.secondary,
          }}
        >
          {getErrorMessage(error, "This screen couldn't load. Try again, or go back to the Board.")}
        </Text>
      </View>
      <View style={{ gap: 12 }}>
        <PillButton label="Try again" variant="dark" onPress={() => void retry()} />
        <PillButton label="Back to the Board" onPress={() => router.replace("/")} />
      </View>
    </View>
  );
}
