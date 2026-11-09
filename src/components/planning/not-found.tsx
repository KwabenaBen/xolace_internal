import { Typography } from "heroui-native";
import type { JSX } from "react";

import { Screen } from "@/components/screen";

/** For a feature/task link that points at nothing (e.g. a wrong id). */
export function NotFound({ what }: { what: "feature" | "task" }): JSX.Element {
  return (
    <Screen withHeader>
      <Typography type="body" color="muted">
        This {what} doesn&apos;t exist.
      </Typography>
    </Screen>
  );
}
