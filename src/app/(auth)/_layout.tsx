import { Stack } from "expo-router";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";

export const unstable_settings = { anchor: "sign-in" };

export default function AuthLayout(): JSX.Element {
  const background = useThemeColor("background");

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: background } }}>
      <Stack.Screen name="sign-in" options={{ title: "Sign in" }} />
      <Stack.Screen name="sign-up" options={{ title: "Create account" }} />
    </Stack>
  );
}
