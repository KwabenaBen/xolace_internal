import { Ionicons } from "@expo/vector-icons";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useIsDesktop } from "@/lib/use-desktop";

import { colors, fonts, usePageColors } from "./theme";

/** How long a confirmation stays before it fades. */
const SHOW_MS = 2600;

type Toast = { id: number; message: string };
type ShowToast = (message: string) => void;

const ToastContext = createContext<ShowToast | null>(null);

/**
 * Says an action worked ("Update posted", "Request approved"), after the team found Cadence gave no
 * feedback once a save went through. Call it after the save succeeds; errors keep showing in the
 * form or card, where they can be fixed.
 */
export function useToast(): ShowToast {
  const show = use(ToastContext);
  if (show === null) throw new Error("useToast needs <ToastProvider> (the root layout).");
  return show;
}

/**
 * Shows confirmations over every screen: a pill in the theme's strongest colour (black, or
 * off-white in dark mode) with a green tick, at the top on a phone and at the bottom on the
 * website layout. It slides in (fades with Reduce Motion), stays a moment and fades away; a new
 * one replaces it. Screen readers hear it. On iOS a card that's still closing sits above it, which
 * is why it's shown once the card's save is done.
 */
export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toast, setToast] = useState<Toast | null>(null);
  const next = useRef(0);
  const clear = useCallback(() => setToast(null), []);
  const show = useCallback<ShowToast>((message) => {
    next.current += 1;
    setToast({ id: next.current, message });
    if (Platform.OS !== "web") AccessibilityInfo.announceForAccessibility(message);
  }, []);

  return (
    <ToastContext value={show}>
      {children}
      <View style={styles.layer}>
        {toast !== null ? (
          <ToastPill key={toast.id} message={toast.message} onDone={clear} />
        ) : null}
      </View>
    </ToastContext>
  );
}

function ToastPill({ message, onDone }: { message: string; onDone: () => void }): JSX.Element {
  const c = usePageColors();
  const insets = useSafeAreaInsets();
  const desktop = useIsDesktop();
  const reduced = useReducedMotion();
  const shown = useSharedValue(0);
  // Slides in from its edge: down from the top on a phone, up from the bottom on the website.
  const from = desktop ? 16 : -16;

  useEffect(() => {
    shown.set(
      reduced ? withTiming(1, { duration: 160 }) : withSpring(1, { damping: 18, stiffness: 220 })
    );
    const hide = setTimeout(() => shown.set(withTiming(0, { duration: 220 })), SHOW_MS);
    const done = setTimeout(onDone, SHOW_MS + 260);
    return () => {
      clearTimeout(hide);
      clearTimeout(done);
    };
  }, [onDone, reduced, shown]);

  const style = useAnimatedStyle(() => ({
    opacity: Math.min(1, shown.get()),
    transform: [{ translateY: reduced ? 0 : (1 - shown.get()) * from }],
  }));

  return (
    <Animated.View
      // The website announces it through this live region; the phone through AccessibilityInfo.
      role="status"
      aria-live="polite"
      style={[
        styles.pill,
        desktop
          ? { bottom: 28, alignSelf: "center" }
          : { top: insets.top + 8, alignSelf: "center" },
        { backgroundColor: c.accent },
        style,
      ]}
    >
      <View style={styles.tick}>
        <Ionicons name="checkmark" size={14} color={colors.ink} />
      </View>
      <Text
        numberOfLines={2}
        style={{ fontFamily: fonts.bold, fontSize: 14, color: c.accentText, flexShrink: 1 }}
      >
        {message}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Over everything, without taking taps from what's underneath.
  layer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    pointerEvents: "box-none",
    zIndex: 1000,
  },
  pill: {
    position: "absolute",
    maxWidth: 420,
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 999,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 18,
    boxShadow: "0 10px 30px rgba(0,0,0,0.22)",
  },
  tick: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
});
