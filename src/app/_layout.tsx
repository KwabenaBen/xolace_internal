import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider, useThemeColor } from "heroui-native";
import { useEffect, type JSX } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { LoadingScreen } from "@/components/loading-screen";
import { OfflineBanner } from "@/components/offline-banner";
import { authStorage } from "@/lib/auth-storage";
import { convex } from "@/lib/convex";

import "../global.css";

// Keep the native splash up until we know whether the user is signed in.
void SplashScreen.preventAutoHideAsync();
export default function RootLayout(): JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ConvexAuthProvider client={convex} storage={authStorage}>
        <HeroUINativeProvider>
          <OfflineBanner>
            <RootNavigator />
          </OfflineBanner>
          <StatusBar style="auto" />
        </HeroUINativeProvider>
      </ConvexAuthProvider>
    </GestureHandlerRootView>
  );
}

/** Signed-out users only reach (auth); signed-in users only reach (app). */
function RootNavigator(): JSX.Element {
  // From convex/react: waits until the server has accepted the auth token.
  const { isLoading, isAuthenticated } = useConvexAuth();
  const background = useThemeColor("background");

  useEffect(() => {
    if (!isLoading) void SplashScreen.hideAsync();
  }, [isLoading]);

  // Mount the navigator only once auth is known, so a refresh on web keeps its URL
  // instead of bouncing through the sign-in screen.
  if (isLoading) return <LoadingScreen />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: background } }}>
      <Stack.Protected guard={isAuthenticated} redirectTo="/sign-in">
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated} redirectTo="/">
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
