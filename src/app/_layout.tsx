import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider, useThemeColor } from "heroui-native";
import { useEffect, useState, type JSX } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { FONT_FILES } from "@/components/ui/theme";
import { LoadingScreen } from "@/components/loading-screen";
import { OfflineBanner } from "@/components/offline-banner";
import { ToastProvider } from "@/components/ui/toast";
import { authStorage } from "@/lib/auth-storage";
import { convex } from "@/lib/convex";
import { applySavedTheme } from "@/lib/theme-preference";

import "../global.css";

// Keep the native splash up until we know whether the user is signed in.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout(): JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ConvexAuthProvider client={convex} storage={authStorage}>
        <HeroUINativeProvider>
          <ToastProvider>
            <OfflineBanner>
              <RootNavigator />
            </OfflineBanner>
          </ToastProvider>
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
  // Montserrat for the Board. If a font fails to load, carry on with the system font.
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  // The theme chosen on this device (Settings → Dark mode) applies before the first screen shows.
  const [themeReady, setThemeReady] = useState(false);
  useEffect(() => {
    void applySavedTheme().finally(() => setThemeReady(true));
  }, []);
  const isReady = !isLoading && themeReady && (fontsLoaded || fontError !== null);

  useEffect(() => {
    if (isReady) void SplashScreen.hideAsync();
  }, [isReady]);

  // Mount the navigator only once auth is known, so a refresh on web keeps its URL
  // instead of bouncing through the sign-in screen.
  if (!isReady) return <LoadingScreen />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: background },
        // Signing in or out swaps the whole app for the welcome screens: a cross-fade, not a push.
        animation: "fade",
      }}
    >
      <Stack.Protected guard={isAuthenticated} redirectTo="/welcome">
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated} redirectTo="/">
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}
