import { Stack } from "expo-router";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";

import { AccountUnavailable } from "@/components/account-unavailable";
import { colors as boardColors, fonts as boardFonts } from "@/components/board/board-theme";
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
      {/* The Board's quick-tile lists keep the Board's black look, whatever the theme. */}
      <Stack.Screen
        name="board/[view]"
        options={{
          headerStyle: { backgroundColor: boardColors.background },
          headerTintColor: boardColors.white,
          headerTitleStyle: { fontFamily: boardFonts.extraBold },
          contentStyle: { backgroundColor: boardColors.background },
        }}
      />
      <Stack.Screen name="features/[featureId]/index" options={{ title: "Feature" }} />
      {/* The task page draws its own header, black whatever the theme. */}
      <Stack.Screen
        name="tasks/[taskId]/index"
        options={{
          title: "Task",
          headerShown: false,
          contentStyle: { backgroundColor: boardColors.background },
        }}
      />
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
