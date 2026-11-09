import { useAuthActions } from "@convex-dev/auth/react";
import { Button, Card, Chip, Separator, Typography } from "heroui-native";
import { useState, type JSX } from "react";
import { View } from "react-native";

import { Screen } from "@/components/screen";
import { ROLE_LABELS } from "@/constants/labels";
import { typography } from "@/constants/theme";
import { useSignedInUser } from "@/lib/use-current-user";

export default function ProfileScreen(): JSX.Element {
  const user = useSignedInUser();
  const { signOut } = useAuthActions();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      // Clears the local session; the root layout's auth guard then shows sign-in.
      await signOut();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <Screen title="Profile">
      <Card>
        <Card.Body className="gap-4">
          <View className="gap-1">
            <Typography.Heading type="h4">{user.name}</Typography.Heading>
            <Typography type={typography.body} color="muted">
              {user.title}
            </Typography>
          </View>
          <View className="flex-row flex-wrap gap-2">
            <Chip color={user.role === "admin" ? "accent" : "default"} variant="soft">
              {ROLE_LABELS[user.role]}
            </Chip>
          </View>
          <Separator />
          <ProfileRow label="Email" value={user.email} />
          <ProfileRow label="Time zone" value={user.timezone} />
        </Card.Body>
      </Card>

      <Button variant="danger-soft" onPress={handleSignOut} isDisabled={isSigningOut}>
        {isSigningOut ? "Signing out…" : "Sign out"}
      </Button>
    </Screen>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View className="gap-0.5">
      <Typography type={typography.caption} color="muted">
        {label}
      </Typography>
      <Typography type={typography.body}>{value}</Typography>
    </View>
  );
}
