import { Stack } from "expo-router";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";

export const unstable_settings = { anchor: "welcome" };

/** Signed-out screens: black or off-white, following the phone's dark/light setting. */
export default function AuthLayout(): JSX.Element {
  const background = useThemeColor("background");
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: background } }}>
      <Stack.Screen name="welcome" options={{ title: "Welcome" }} />
      <Stack.Screen name="sign-in" options={{ title: "Sign in" }} />
      <Stack.Screen name="sign-up" options={{ title: "Join Cadence" }} />
    </Stack>
  );
}
