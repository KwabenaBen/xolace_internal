import { Stack, type ErrorBoundaryProps } from "expo-router";
import { useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

import { fonts } from "@/components/ui/theme";
import { AccountUnavailable } from "@/components/account-unavailable";
import { ErrorScreen } from "@/components/error-screen";
import { HeaderCancel } from "@/components/planning/header-cancel";
import { LoadingScreen } from "@/components/loading-screen";
import { Sidebar } from "@/components/web/sidebar";
import { useCurrentUser } from "@/lib/use-current-user";
import { useIsDesktop } from "@/lib/use-desktop";

/**
 * The tabs always sit under every pushed page and modal, even when the app opens straight onto
 * one (a web refresh or a link), so back and "done" always have somewhere to go.
 */
export const unstable_settings = { anchor: "(tabs)" };

/** A screen that throws shows this instead of a blank page: Try again, or back to the Board. */
export function ErrorBoundary(props: ErrorBoundaryProps): JSX.Element {
  return <ErrorScreen {...props} />;
}

/**
 * Signed-in area: the tabs, plus feature/task pages pushed over them and create/edit forms
 * shown as modals. Renders only once the user's profile is loaded and active. On a wide browser
 * window (the website layout, src/components/web/) the sidebar sits beside every page and the
 * forms open as dialogs over the page they came from.
 */
export default function AppLayout(): JSX.Element {
  const user = useCurrentUser();
  const [background, foreground] = useThemeColor(["background", "foreground"]);
  const desktop = useIsDesktop();

  // Pages that draw their own header (back button, then the title) on the theme's page colour.
  const ownHeader = { headerShown: false, contentStyle: { backgroundColor: background } };
  // Form modals: native iOS sheets (swipe down to close) with an ✕ at the top left. With unsaved
  // changes, both the swipe and Cancel ask first (useUnsavedGuard blocks the native dismiss).
  // Pushed pages keep the native push and swipe back (from anywhere on the screen on iOS 26).
  // On a wide browser window the page underneath stays visible and the form draws its own dialog
  // (Screen, src/components/screen.tsx).
  const form = desktop
    ? {
        presentation: "transparentModal" as const,
        headerShown: false,
        contentStyle: { backgroundColor: "transparent" },
      }
    : { presentation: "modal" as const, headerLeft: () => <HeaderCancel /> };

  if (user === undefined) return <LoadingScreen />;
  if (user === null || !user.isActive) return <AccountUnavailable user={user} />;

  const stack = (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: background },
        // Form modals: a header in the page colour (black or off-white) with a Montserrat title.
        headerStyle: { backgroundColor: background },
        headerTintColor: foreground,
        headerTitleStyle: { fontFamily: fonts.extraBold },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* The Board's tile pages and the feature, person and task pages draw their own header. */}
      <Stack.Screen name="board/[view]" options={{ title: "Board", ...ownHeader }} />
      <Stack.Screen
        name="features/[featureId]/index"
        options={{ title: "Feature", ...ownHeader }}
      />
      <Stack.Screen
        name="features/[featureId]/people/[userId]"
        options={{ title: "Person", ...ownHeader }}
      />
      {/* On the website layout a task opens as a side panel over the page it came from. */}
      <Stack.Screen
        name="tasks/[taskId]/index"
        options={{ title: "Task", ...(desktop ? form : ownHeader) }}
      />
      <Stack.Screen name="settings/account" options={{ title: "Account", ...ownHeader }} />
      <Stack.Screen name="settings/people/index" options={{ title: "People", ...ownHeader }} />
      <Stack.Screen name="settings/team-rules" options={{ title: "Team rules", ...ownHeader }} />
      <Stack.Screen name="activity" options={{ title: "Activity", ...ownHeader }} />
      <Stack.Screen name="logs/[userId]" options={{ title: "Logs", ...ownHeader }} />
      <Stack.Screen name="features/new" options={{ title: "New feature", ...form }} />
      <Stack.Screen name="features/[featureId]/edit" options={{ title: "Edit feature", ...form }} />
      <Stack.Screen name="tasks/new" options={{ title: "New task", ...form }} />
      <Stack.Screen name="tasks/[taskId]/edit" options={{ title: "Edit task", ...form }} />
      <Stack.Screen name="settings/people/invite" options={{ title: "Invite someone", ...form }} />
      <Stack.Screen name="logs/write" options={{ title: "Today's log", ...form }} />
    </Stack>
  );

  if (!desktop) return stack;
  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: background }}>
      <Sidebar />
      <View style={{ flex: 1 }}>{stack}</View>
    </View>
  );
}
