import { Stack } from "expo-router";
import type { JSX } from "react";

export const unstable_settings = { anchor: "welcome" };

/** Signed-out screens. Always black, whatever the phone's light/dark setting. */
export default function AuthLayout(): JSX.Element {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#000000" } }}>
      <Stack.Screen name="welcome" options={{ title: "Welcome" }} />
      <Stack.Screen name="sign-in" options={{ title: "Sign in" }} />
      <Stack.Screen name="sign-up" options={{ title: "Join Cadence" }} />
    </Stack>
  );
}
