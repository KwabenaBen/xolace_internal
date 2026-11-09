import { Typography } from "heroui-native";
import type { JSX, ReactNode } from "react";

import { Screen } from "@/components/screen";
import { useSignedInUser } from "@/lib/use-current-user";

/**
 * Hides admin screens from members who reach them by link. Cosmetic only: the server
 * rejects every admin action from members anyway.
 */
export function AdminOnly({ children }: { children: ReactNode }): JSX.Element {
  const user = useSignedInUser();
  if (user.role === "admin") return <>{children}</>;
  return (
    <Screen withHeader>
      <Typography type="body" color="muted">
        Only admins can do this.
      </Typography>
    </Screen>
  );
}
