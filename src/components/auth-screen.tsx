import { Alert, Card, Typography } from "heroui-native";
import type { JSX, ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing, typography } from "@/constants/theme";

type AuthScreenProps = {
  subtitle: string;
  /** Message from the last failed attempt, shown above the form. */
  error: string | null;
  children: ReactNode;
  footer?: ReactNode;
};

/** Shared frame for the sign-in and sign-up screens. */
export function AuthScreen({ subtitle, error, children, footer }: AuthScreenProps): JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerClassName="grow justify-center px-5"
        contentContainerStyle={{
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="w-full max-w-md gap-6 self-center">
          <View className="gap-1">
            <Typography.Heading type="h1">Cadence</Typography.Heading>
            <Typography type={typography.body} color="muted">
              {subtitle}
            </Typography>
          </View>

          {error !== null ? (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Description>{error}</Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}

          <Card>
            <Card.Body className="gap-4">{children}</Card.Body>
          </Card>

          {footer}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
