import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useThemeColor } from "heroui-native";
import type { JSX, ReactNode } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing } from "@/constants/theme";

import { DotWordmark } from "./dot-wordmark";

type AuthFormScreenProps = {
  title: string;
  subtitle: string;
  /** Message from the last failed attempt, shown above the form. */
  error: string | null;
  children: ReactNode;
  footer?: ReactNode;
};

/** Frame for the sign-in and sign-up forms: back arrow, dot wordmark, big title, in the theme. */
export function AuthFormScreen({
  title,
  subtitle,
  error,
  children,
  footer,
}: AuthFormScreenProps): JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const foreground = useThemeColor("foreground");

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/welcome");
  }

  return (
    <View className="flex-1 bg-background">
      <StatusBar style="auto" />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="grow px-5"
          contentContainerStyle={{
            paddingTop: insets.top + spacing.sm,
            paddingBottom: insets.bottom + spacing.xl,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="w-full max-w-md flex-1 self-center">
            <View className="h-12 flex-row items-center justify-between">
              <Pressable
                onPress={goBack}
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={12}
                className="h-10 w-10 items-center justify-center rounded-full bg-surface active:opacity-70"
              >
                <Ionicons name="chevron-back" size={22} color={foreground} />
              </Pressable>
              <DotWordmark width={96} color={foreground} />
              <View className="h-10 w-10" />
            </View>

            <View className="gap-2 pb-8 pt-10">
              <Text accessibilityRole="header" className="text-4xl font-bold text-foreground">
                {title}
              </Text>
              <Text className="text-base leading-6 text-muted">{subtitle}</Text>
            </View>

            {error !== null ? (
              <View
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                className="mb-5 rounded-2xl border border-danger bg-surface px-4 py-3"
              >
                <Text className="text-sm leading-5 text-foreground">{error}</Text>
              </View>
            ) : null}

            <View className="gap-5">{children}</View>

            <View className="min-h-6 flex-1" />
            {footer}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
