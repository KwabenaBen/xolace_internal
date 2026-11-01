import { useAuthActions } from "@convex-dev/auth/react";
import { Button, Card, Typography } from "heroui-native";
import type { JSX } from "react";

import { Screen } from "@/components/screen";
import { typography } from "@/constants/theme";
import type { CurrentUser } from "@/lib/use-current-user";

/**
 * Shown when a signed-in session no longer maps to an active user: the account was
 * deactivated (the server already rejects all its requests) or the user record is gone.
 */
export function AccountUnavailable({ user }: { user: CurrentUser | null }): JSX.Element {
  const { signOut } = useAuthActions();
  const message =
    user === null
      ? "We couldn't find your Cadence profile. Sign out and sign in again, or ask an admin for help."
      : "Your account has been deactivated. Ask an admin to reactivate it.";

  return (
    <Screen title="Account unavailable">
      <Card>
        <Card.Body className="gap-4">
          <Typography type={typography.body}>{message}</Typography>
          <Button variant="secondary" onPress={() => void signOut()}>
            Sign out
          </Button>
        </Card.Body>
      </Card>
    </Screen>
  );
}
