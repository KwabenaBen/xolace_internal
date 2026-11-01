import { Typography } from "heroui-native";
import type { JSX, ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { layout, spacing, typography } from "@/constants/theme";

type ScreenProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
};

/** Standard tab screen: safe-area aware, scrollable, centred and width-capped on web. */
export function Screen({ title, subtitle, children }: ScreenProps): JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="grow px-5 pb-10"
      keyboardShouldPersistTaps="handled"
    >
      <View
        className="w-full gap-6 self-center"
        style={{ maxWidth: layout.maxContentWidth, paddingTop: insets.top + spacing.xl }}
      >
        {title !== undefined ? (
          <View className="gap-1">
            <Typography.Heading type={typography.screenTitle}>{title}</Typography.Heading>
            {subtitle !== undefined ? (
              <Typography type={typography.caption} color="muted">
                {subtitle}
              </Typography>
            ) : null}
          </View>
        ) : null}
        {children}
      </View>
    </ScrollView>
  );
}
