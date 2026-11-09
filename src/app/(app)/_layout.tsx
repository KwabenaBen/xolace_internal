import { Stack } from "expo-router";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";

import { AccountUnavailable } from "@/components/account-unavailable";
import { LoadingScreen } from "@/components/loading-screen";
import { useCurrentUser } from "@/lib/use-current-user";

/**
 * Signed-in area: the tabs, plus feature/task pages pushed over them and create/edit forms
 * shown as modals. Renders only once the user's profile is loaded and active.
 */
export default function AppLayout(): JSX.Element {
  const user = useCurrentUser();
  const [background, surface, foreground] = useThemeColor(["background", "surface", "foreground"]);

  if (user === undefined) return <LoadingScreen />;
  if (user === null || !user.isActive) return <AccountUnavailable user={user} />;

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: background },
        headerStyle: { backgroundColor: surface },
        headerTintColor: foreground,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="features/[featureId]/index" options={{ title: "Feature" }} />
      <Stack.Screen name="tasks/[taskId]/index" options={{ title: "Task" }} />
      <Stack.Screen name="features/new" options={{ title: "New feature", presentation: "modal" }} />
      <Stack.Screen
        name="features/[featureId]/edit"
        options={{ title: "Edit feature", presentation: "modal" }}
      />
      <Stack.Screen name="tasks/new" options={{ title: "New task", presentation: "modal" }} />
      <Stack.Screen
        name="tasks/[taskId]/edit"
        options={{ title: "Edit task", presentation: "modal" }}
      />
    </Stack>
  );
}
