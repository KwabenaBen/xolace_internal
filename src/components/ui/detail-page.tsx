import { Stack, useIsFocused, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { JSX, ReactNode } from "react";
import { ActivityIndicator, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MAX_BOARD_WIDTH, REFERENCE_WIDTH } from "@/components/board/board-theme";

import { RoundButton } from "./page-header";
import { symbols } from "./sym";
import { fonts, usePageColors } from "./theme";

const GUTTER = 18;

/**
 * Sizes for the detail pages (task, feature, person, the Board's tile pages): `s` scales the reference's points as
 * on the Board (capped at 520 wide), `content` is the column width inside the side gutters.
 */
export function usePageSize(): { s: number; content: number } {
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth, MAX_BOARD_WIDTH);
  return { s: width / REFERENCE_WIDTH, content: width - GUTTER * 2 };
}

/** Back to wherever the page was opened from, or to the Board after a deep link. */
export function useGoBack(): () => void {
  const router = useRouter();
  return () => (router.canGoBack() ? router.back() : router.replace("/"));
}

/**
 * A detail page: its own header (the stack's is hidden), one scrolling column centred on wide
 * screens, on the theme's page colour (black or off-white).
 */
export function DetailPage({
  title,
  content,
  children,
}: {
  /** The browser tab's title on the web. */
  title: string;
  content: number;
  children: ReactNode;
}): JSX.Element {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const c = usePageColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.page }}>
      <Stack.Screen options={{ title }} />
      {isFocused ? <StatusBar style={c.statusBar} /> : null}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 40,
          alignItems: "center",
        }}
      >
        <View style={{ width: content }}>{children}</View>
      </ScrollView>
    </View>
  );
}

export function PageLoading(): JSX.Element {
  const c = usePageColors();
  return (
    <View style={{ paddingTop: 80, alignItems: "center" }}>
      <ActivityIndicator color={c.text} />
    </View>
  );
}

/** For a link that points at nothing (a wrong or deleted id). */
export function PageNotFound({
  s,
  message,
  onBack,
}: {
  s: number;
  message: string;
  onBack: () => void;
}): JSX.Element {
  const c = usePageColors();
  return (
    <View style={{ gap: 24 }}>
      <View style={{ flexDirection: "row" }}>
        <RoundButton symbol={symbols.back} label="Back" onPress={onBack} s={s} />
      </View>
      <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: c.muted }}>{message}</Text>
    </View>
  );
}
