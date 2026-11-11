import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Typography } from "heroui-native";
import { useEffect, useRef, type ComponentRef, type JSX, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePageColors } from "@/components/ui/theme";
import { playOut, useEnterFrom } from "@/components/web/motion";
import { webType } from "@/components/web/web-theme";
import { layout, spacing, typography } from "@/constants/theme";
import { useIsDesktop } from "@/lib/use-desktop";

type ScreenProps = {
  title?: string;
  subtitle?: string;
  /** Shown to the right of the title, e.g. a "New feature" button. */
  action?: ReactNode;
  /** The screen sits under a navigation header, so it doesn't need the top safe-area inset. */
  withHeader?: boolean;
  /** On a wide browser window, a form screen opens as a dialog with this title. */
  dialogTitle?: string;
  /** Pinned below the scrolling content (e.g. a form's submit button). */
  footer?: ReactNode;
  children: ReactNode;
};

/** Closing a form: back if there's somewhere to go (its unsaved-changes guard asks first). */
function closeForm() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

/**
 * A form as a dialog on the website layout: a card over the dimmed page it was opened from, with
 * its title and a close button; a click outside or Esc closes it (asking first if there are
 * unsaved changes: useUnsavedGuard). It eases in (the dim fades, the card rises and settles) and,
 * closed that way, eases out first; if "Discard changes?" is answered no, it eases back in. After a
 * save the form closes it straight away.
 */
function Dialog({
  title,
  footer,
  children,
}: {
  title: string;
  footer?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  const c = usePageColors();
  const card = useRef<ComponentRef<typeof View>>(null);
  const dim = useRef<ComponentRef<typeof View>>(null);
  const closing = useRef(false);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );
  useEnterFrom(dim, { opacity: 0 }, 0.3);
  useEnterFrom(card, { opacity: 0, y: 18, scale: 0.97 }, 0.42);

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    void Promise.all([
      playOut([card], { opacity: 0, y: 12, scale: 0.98 }, 0.2),
      playOut([dim], { opacity: 0 }, 0.22),
    ]).then(() => {
      closeForm();
      // Still here: the unsaved-changes guard kept it open, so bring it back.
      setTimeout(() => {
        if (!mounted.current) return;
        closing.current = false;
        void playOut([card], { opacity: 1, y: 0, scale: 1 }, 0.25);
        void playOut([dim], { opacity: 1 }, 0.25);
      }, 80);
    });
  };

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <View style={styles.backdrop}>
      <View ref={dim} style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.35)" }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={close}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View
        ref={card}
        accessibilityViewIsModal
        aria-modal
        role="dialog"
        aria-label={title}
        style={{
          width: "100%",
          maxWidth: 640,
          maxHeight: "88%",
          borderRadius: 14,
          borderWidth: 1,
          borderColor: c.hairline,
          backgroundColor: c.page,
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 24,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: c.hairline,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{ ...webType.heading, fontSize: 16, color: c.text }}
          >
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            onPress={close}
            className="active:opacity-60"
          >
            <Ionicons name="close" size={20} color={c.muted} />
          </Pressable>
        </View>
        <ScrollView
          style={{ flexShrink: 1 }}
          contentContainerStyle={{ padding: 24, gap: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
        {footer !== undefined ? (
          <View
            style={{
              paddingHorizontal: 24,
              paddingVertical: 16,
              borderTopWidth: 1,
              borderTopColor: c.hairline,
            }}
          >
            {footer}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Standard screen: safe-area aware, scrollable, keyboard aware, width-capped on web. A form screen
 * (`withHeader`) opens as a dialog on the website layout (a wide browser window).
 */
export function Screen({
  title,
  subtitle,
  action,
  withHeader = false,
  dialogTitle,
  footer,
  children,
}: ScreenProps): JSX.Element {
  const insets = useSafeAreaInsets();
  const desktop = useIsDesktop();
  const paddingTop = withHeader ? spacing.lg : insets.top + spacing.xl;

  if (desktop && withHeader) {
    return (
      <Dialog title={dialogTitle ?? title ?? ""} footer={footer}>
        {children}
      </Dialog>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={withHeader ? 64 : 0}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="grow px-5 pb-10"
        keyboardShouldPersistTaps="handled"
      >
        <View
          className="w-full gap-6 self-center"
          style={{ maxWidth: layout.maxContentWidth, paddingTop }}
        >
          {title !== undefined ? (
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1 gap-1">
                <Typography.Heading type={typography.screenTitle}>{title}</Typography.Heading>
                {subtitle !== undefined ? (
                  <Typography type={typography.caption} color="muted">
                    {subtitle}
                  </Typography>
                ) : null}
              </View>
              {action}
            </View>
          ) : null}
          {children}
        </View>
      </ScrollView>
      {footer !== undefined ? (
        <View
          className="border-t border-border bg-background px-5 pt-3"
          style={{ paddingBottom: insets.bottom + spacing.md }}
        >
          <View className="w-full self-center" style={{ maxWidth: layout.maxContentWidth }}>
            {footer}
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
});
