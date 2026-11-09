import { Alert } from "heroui-native";
import type { JSX } from "react";

/** The message from a failed save, shown at the top of a form. */
export function FormError({ message }: { message: string | null }): JSX.Element | null {
  if (message === null) return null;
  return (
    <Alert status="danger">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{message}</Alert.Description>
      </Alert.Content>
    </Alert>
  );
}
