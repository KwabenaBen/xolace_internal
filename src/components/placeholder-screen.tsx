import { Card, Typography } from "heroui-native";
import type { JSX } from "react";

import { Screen } from "@/components/screen";
import { typography } from "@/constants/theme";

type PlaceholderScreenProps = {
  title: string;
  subtitle: string;
  /** Which build phase delivers this screen, e.g. "Phase 2 — Features & tasks". */
  comingIn: string;
  description: string;
};

/** Stand-in for screens that later phases build out. */
export function PlaceholderScreen({
  title,
  subtitle,
  comingIn,
  description,
}: PlaceholderScreenProps): JSX.Element {
  return (
    <Screen title={title} subtitle={subtitle}>
      <Card>
        <Card.Body className="gap-2">
          <Card.Title>{comingIn}</Card.Title>
          <Typography type={typography.body} color="muted">
            {description}
          </Typography>
        </Card.Body>
      </Card>
    </Screen>
  );
}
