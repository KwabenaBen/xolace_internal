import { Typography } from "heroui-native";
import type { JSX, ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { layout, spacing, typography } from "@/constants/theme";

type ScreenProps = {
  title?: string;
  subtitle?: string;
  /** Shown to the right of the title, e.g. a "New feature" button. */
  action?: ReactNode;
  /** The screen sits under a navigation header, so it doesn't need the top safe-area inset. */
  withHeader?: boolean;
  /** Pinned below the scrolling content (e.g. a form's submit button). */
  footer?: ReactNode;
  children: ReactNode;
};

/** Standard screen: safe-area aware, scrollable, keyboard aware, width-capped on web. */
export function Screen({
  title,
  subtitle,
  action,
  withHeader = false,
  footer,
  children,
}: ScreenProps): JSX.Element {
  const insets = useSafeAreaInsets();
  const paddingTop = withHeader ? spacing.lg : insets.top + spacing.xl;

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
