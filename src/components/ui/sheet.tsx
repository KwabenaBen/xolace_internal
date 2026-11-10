import { BlurView } from "expo-blur";
import { createContext, use, useEffect, type JSX, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type ScrollViewProps,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  measure,
  useAnimatedProps,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type AnimatedRef,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useReduceTransparency } from "@/lib/use-reduce-transparency";

import { usePageColors } from "./theme";

/*
 Every overlay card in Cadence (a person's card, the invite actions, the option and date pickers)
 is a Sheet: it rises from the bottom over a blurred, dimmed page, so the eye goes to the card.
 Swipe it down to close it (anywhere on the card while its content is scrolled to the top; the
 blur clears as it goes), or tap the page around it, or the phone's back gesture. All of those,
 and a close from the content (`useSheet().close`), play the same exit.
 Reduce Motion: the card fades in and out instead of sliding (a swipe still follows the finger).
 Reduce Transparency: a plain darker dim instead of the blur.
*/

const RISE = { damping: 24, stiffness: 240, mass: 0.9 } as const;
const EXIT = { duration: 240, easing: Easing.in(Easing.cubic) } as const;
/** How far (points) a swipe has to pull the card down before letting go closes it. */
const DISMISS_AT = 110;
const BLUR = 55;

const AnimatedBlur = Animated.createAnimatedComponent(BlurView);

export type SheetApi = {
  /** Play the exit, then call the sheet's onClose. Works even while locked (e.g. after a save). */
  close: () => void;
  /** Lock against the reader closing it (swipe, outside, back) while something is saving. */
  setLocked: (locked: boolean) => void;
};

type SheetContextValue = SheetApi & {
  scrollGesture: ReturnType<typeof Gesture.Native>;
  scrollTop: SharedValue<number>;
  noSwipe: AnimatedRef<View>;
  hasNoSwipe: SharedValue<boolean>;
};

const SheetContext = createContext<SheetContextValue | null>(null);

/** The sheet the component sits in: close it, or lock it while saving. */
export function useSheet(): SheetApi {
  const sheet = use(SheetContext);
  if (sheet === null) throw new Error("useSheet() is only for content inside a <Sheet>.");
  return sheet;
}

/**
 * The scrolling part of a sheet's content. Use it instead of ScrollView so a swipe down scrolls
 * the content first and moves the card only once the content is back at its top.
 */
export function SheetScrollView({ style, ...props }: ScrollViewProps): JSX.Element {
  const sheet = use(SheetContext);
  if (sheet === null) throw new Error("SheetScrollView is only for content inside a <Sheet>.");
  const { scrollTop } = sheet;
  // A new list starts at its top, and a list that goes (e.g. swapped for a confirmation) leaves
  // nothing behind that would stop the card being swiped down.
  useEffect(() => {
    scrollTop.set(0);
    return () => scrollTop.set(0);
  }, [scrollTop]);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollTop.set(e.contentOffset.y);
    },
  });
  return (
    <GestureDetector gesture={sheet.scrollGesture}>
      <Animated.ScrollView
        bounces={false}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        {...props}
        style={[{ flexGrow: 0, flexShrink: 1 }, style]}
        onScroll={onScroll}
      />
    </GestureDetector>
  );
}

/**
 * Part of a sheet's content that a swipe never moves the card from: for a control that is
 * dragged up and down itself, like the iOS time wheel. One per sheet.
 */
export function SheetNoSwipe({ children }: { children: ReactNode }): JSX.Element {
  const sheet = use(SheetContext);
  if (sheet === null) throw new Error("SheetNoSwipe is only for content inside a <Sheet>.");
  const { noSwipe, hasNoSwipe } = sheet;
  useEffect(() => {
    hasNoSwipe.set(true);
    return () => hasNoSwipe.set(false);
  }, [hasNoSwipe]);
  return <Animated.View ref={noSwipe}>{children}</Animated.View>;
}

/**
 * An overlay card that rises from the bottom (see the note at the top of this file). Mount it to
 * open it; `onClose` runs after the exit, when the parent should unmount it.
 */
export function Sheet({
  onClose,
  backgroundColor,
  grabberColor,
  maxWidth = 460,
  children,
}: {
  onClose: () => void;
  /** The card's colour (default: the theme's panel colour). */
  backgroundColor?: string;
  /** The grab bar's colour, for cards whose top isn't the panel colour (e.g. a pastel). */
  grabberColor?: string;
  /** On wide screens the card stays this wide, centred. */
  maxWidth?: number;
  children: ReactNode | ((sheet: SheetApi) => ReactNode);
}): JSX.Element {
  const c = usePageColors();
  const { height: screenH } = useWindowDimensions();
  const reduced = useReducedMotion();
  const plain = useReduceTransparency();
  // Where the card sits: 0 = open, screenH = below the screen. `shown` is the page's blur and dim
  // (and, with Reduce Motion, the card's opacity).
  const y = useSharedValue(reduced ? 0 : screenH);
  const shown = useSharedValue(0);
  const scrollTop = useSharedValue(0);
  const dragging = useSharedValue(false);
  const locked = useSharedValue(false);
  const closing = useSharedValue(false);
  const noSwipe = useAnimatedRef<View>();
  const hasNoSwipe = useSharedValue(false);

  useEffect(() => {
    if (!reduced) y.set(withSpring(0, RISE));
    shown.set(withTiming(1, { duration: reduced ? 160 : 280 }));
  }, [reduced, shown, y]);

  function close() {
    if (closing.get()) return;
    closing.set(true);
    if (!reduced) y.set(withTiming(screenH, EXIT));
    shown.set(
      withTiming(0, { duration: EXIT.duration }, (finished) => {
        if (finished === true) scheduleOnRN(onClose);
      })
    );
  }

  /** The reader asking to close (outside, back, ✕-less escape): not while locked. */
  function requestClose() {
    if (!locked.get()) close();
  }

  const scrollGesture = Gesture.Native();
  const swipe = Gesture.Pan()
    .activeOffsetY(10) // downward only: an upward drag is the content's scroll
    .failOffsetX([-24, 24])
    .simultaneousWithExternalGesture(scrollGesture)
    .onTouchesDown((e, manager) => {
      // A drag that starts on a SheetNoSwipe part (e.g. the time wheel) is that control's.
      if (!hasNoSwipe.get()) return;
      const zone = measure(noSwipe);
      const touch = e.allTouches[0];
      if (
        zone !== null &&
        touch !== undefined &&
        touch.absoluteY >= zone.pageY &&
        touch.absoluteY <= zone.pageY + zone.height
      ) {
        manager.fail();
      }
    })
    .onStart(() => {
      dragging.set(!locked.get() && !closing.get() && scrollTop.get() <= 0);
    })
    .onUpdate((e) => {
      if (dragging.get()) y.set(Math.max(0, e.translationY));
    })
    .onEnd((e) => {
      if (!dragging.get()) return;
      dragging.set(false);
      if (y.get() > DISMISS_AT || (e.velocityY > 800 && y.get() > 16)) scheduleOnRN(close);
      else y.set(withSpring(0, RISE));
    });

  // How much of the page is hidden: all of it when open, clearing as the card is pulled down.
  const cover = () => {
    "worklet";
    return shown.get() * Math.max(0, 1 - y.get() / (screenH * 0.6));
  };
  const blurProps = useAnimatedProps(() => ({ intensity: BLUR * cover() }));
  const dimStyle = useAnimatedStyle(() => ({ opacity: cover() }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.get() }],
    opacity: reduced ? shown.get() : 1,
  }));

  const api: SheetApi = { close, setLocked: (next) => locked.set(next) };

  return (
    <Modal visible transparent animationType="none" onRequestClose={requestClose}>
      {/* A modal sits outside the app's gesture root on iOS, so it needs its own. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        {plain ? null : (
          <AnimatedBlur
            animatedProps={blurProps}
            intensity={0}
            tint={c.scheme === "dark" ? "dark" : "light"}
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
          />
        )}
        <Animated.View
          style={[
            { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
            // a scrim, not a page colour: lighter over the blur, darker without it
            { backgroundColor: plain ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.25)" },
            dimStyle,
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={requestClose}
            style={{ flex: 1 }}
          />
        </Animated.View>
        <View style={styles.stage}>
          <GestureDetector gesture={swipe}>
            <Animated.View
              accessibilityViewIsModal
              onAccessibilityEscape={requestClose}
              style={[
                {
                  width: "100%",
                  maxWidth,
                  maxHeight: "92%",
                  borderTopLeftRadius: 30,
                  borderTopRightRadius: 30,
                  borderCurve: "continuous",
                  overflow: "hidden",
                  backgroundColor: backgroundColor ?? c.panel,
                },
                cardStyle,
              ]}
            >
              <SheetContext value={{ ...api, scrollGesture, scrollTop, noSwipe, hasNoSwipe }}>
                <View style={{ flexShrink: 1 }}>
                  {typeof children === "function" ? children(api) : children}
                </View>
              </SheetContext>
              {/* the grab bar: says the card can be pulled down */}
              <View
                aria-hidden
                style={{
                  position: "absolute",
                  top: 8,
                  alignSelf: "center",
                  width: 40,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: grabberColor ?? c.muted,
                  opacity: grabberColor === undefined ? 0.5 : 1,
                  pointerEvents: "none",
                }}
              />
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Lets taps outside the card through to the dim behind it (closes the sheet). In a StyleSheet,
  // not inline: React Native Web only translates "box-none" for StyleSheet styles.
  stage: { flex: 1, justifyContent: "flex-end", alignItems: "center", pointerEvents: "box-none" },
});
