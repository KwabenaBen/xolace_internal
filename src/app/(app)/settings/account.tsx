import { useAuthActions } from "@convex-dev/auth/react";
import { useState, type JSX } from "react";
import { Text, View } from "react-native";

import { DetailPage, useGoBack, usePageSize } from "@/components/ui/detail-page";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { PillButton } from "@/components/ui/pill-button";
import { RolePill } from "@/components/ui/role-pill";
import { fonts, usePageColors } from "@/components/ui/theme";
import { getErrorMessage } from "@/lib/errors";
import { useSignedInUser } from "@/lib/use-current-user";

/** Settings → Account & security: who you are on Cadence, and sign out. */
export default function AccountScreen(): JSX.Element {
  const user = useSignedInUser();
  const { signOut } = useAuthActions();
  const goBack = useGoBack();
  const { s, content } = usePageSize();
  const c = usePageColors();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    setError(null);
    setIsSigningOut(true);
    try {
      // Clears the local session; the root layout's auth guard then shows the welcome screen.
      await signOut();
    } catch (e) {
      setError(getErrorMessage(e, "Couldn't sign out. Check your connection and try again."));
      setIsSigningOut(false);
    }
  }

  const row = (label: string, value: string) => (
    <View style={{ gap: 2 }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: c.muted }}>{label}</Text>
      <Text selectable style={{ fontFamily: fonts.semibold, fontSize: 16, color: c.text }}>
        {value}
      </Text>
    </View>
  );

  return (
    <DetailPage title="Account" content={content}>
      <View style={{ gap: 22 * s }}>
        <PageHeader s={s} title={user.name} subtitle={user.title} onBack={goBack} />
        <Panel s={s} title="Account" aside={<RolePill role={user.role} />}>
          {row("Email", user.email)}
          {row("Time zone", user.timezone)}
        </Panel>
        <Text style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: c.muted }}>
          Your password can&apos;t be seen by anyone, admins included. A way to reset a forgotten
          one isn&apos;t built yet.
        </Text>
        {error !== null ? (
          <Text
            accessibilityRole="alert"
            style={{ fontFamily: fonts.semibold, fontSize: 14, color: c.danger }}
          >
            {error}
          </Text>
        ) : null}
        <PillButton
          label={isSigningOut ? "Signing out…" : "Sign out"}
          onPress={handleSignOut}
          isLoading={isSigningOut}
        />
      </View>
    </DetailPage>
  );
}
