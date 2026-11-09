import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { JSX } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DotField } from "@/components/auth/dot-field";
import { PillButton } from "@/components/auth/pill-button";
import { spacing } from "@/constants/theme";

/** Largest the dot field gets, so it doesn't sprawl on desktop web. */
const MAX_FIELD_WIDTH = 420;

export default function WelcomeScreen(): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const fieldWidth = Math.min(windowWidth - spacing.xl * 2, MAX_FIELD_WIDTH);

  return (
    <View
      className="flex-1 bg-black px-5"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom + spacing.lg }}
    >
      <StatusBar style="light" />

      <View className="flex-1 items-center justify-center">
        <DotField width={fieldWidth} />
      </View>

      <View className="w-full max-w-md gap-3 self-center">
        <View className="items-center gap-2 pb-5">
          <Text accessibilityRole="header" className="text-4xl font-bold text-white">
            Welcome
          </Text>
          <Text className="text-center text-base text-neutral-400">
            Every task, one owner, one deadline.
          </Text>
        </View>

        <PillButton label="Sign in" onPress={() => router.push("/sign-in")} />
        <PillButton
          label="I have an invite"
          variant="dark"
          onPress={() => router.push("/sign-up")}
        />

        <Text className="px-6 pt-3 text-center text-xs leading-5 text-neutral-500">
          Cadence is invite-only. To join, use the email address your invite was sent to.
        </Text>
      </View>
    </View>
  );
}
