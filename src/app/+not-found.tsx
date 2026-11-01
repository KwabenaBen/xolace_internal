import { useRouter } from "expo-router";
import { Button, Typography } from "heroui-native";
import type { JSX } from "react";

import { Screen } from "@/components/screen";
import { typography } from "@/constants/theme";

export default function NotFoundScreen(): JSX.Element {
  const router = useRouter();

  return (
    <Screen title="Page not found">
      <Typography type={typography.body} color="muted">
        This page doesn&apos;t exist.
      </Typography>
      <Button onPress={() => router.replace("/")}>Go to the board</Button>
    </Screen>
  );
}
