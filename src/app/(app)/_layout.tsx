import { Stack, type ErrorBoundaryProps } from "expo-router";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";

import { AccountUnavailable } from "@/components/account-unavailable";
import { colors as boardColors, fonts as boardFonts } from "@/components/board/board-theme";
import { ErrorScreen } from "@/components/error-screen";
import { LoadingScreen } from "@/components/loading-screen";
import { useCurrentUser } from "@/lib/use-current-user";

/**
 * The tabs always sit under every pushed page and modal, even when the app opens straight onto
 * one (a web refresh or a link), so back and "done" always have somewhere to go.
 */
export const unstable_settings = { anchor: "(tabs)" };

/** A screen that throws shows this instead of a blank page: Try again, or back to the Board. */
export function ErrorBoundary(props: ErrorBoundaryProps): JSX.Element {
  return <ErrorScreen {...props} />;
}

const BLACK_PAGE = {
  headerShown: false,
  contentStyle: { backgroundColor: boardColors.background },
} as const;

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
      {/* The feature, person and task pages draw their own header, black whatever the theme. */}
      <Stack.Screen
        name="features/[featureId]/index"
        options={{ title: "Feature", ...BLACK_PAGE }}
      />
      <Stack.Screen
        name="features/[featureId]/people/[userId]"
        options={{ title: "Person", ...BLACK_PAGE }}
      />
      <Stack.Screen name="tasks/[taskId]/index" options={{ title: "Task", ...BLACK_PAGE }} />
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
