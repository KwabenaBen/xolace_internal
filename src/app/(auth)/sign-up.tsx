import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "expo-router";
import { useState, type JSX } from "react";
import { Pressable, Text } from "react-native";

import { INVITE_DAYS, INVITE_REJECTED_MESSAGE, MIN_PASSWORD_LENGTH } from "@convex/lib/constants";

import { AuthFormScreen } from "@/components/auth/auth-form-screen";
import { AuthTextField } from "@/components/auth/auth-text-field";
import { PillButton } from "@/components/ui/pill-button";
import { getErrorMessage } from "@/lib/errors";

export default function SignUpScreen(): JSX.Element {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignUp() {
    if (name.trim().length === 0 || email.trim().length === 0) {
      setError("Enter your name and the email your invite was sent to.");
      return;
    }
    if (inviteCode.trim().length === 0) {
      setError("Enter the invite code from your invite.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      // The server only creates the account for an unused, unexpired invite and its code.
      await signIn("password", { name, email, inviteCode, password, flow: "signUp" });
    } catch (e) {
      // Every refusal reads the same (including "already registered", which Convex Auth reports
      // itself), so sign-up never reveals who is invited.
      setError(getErrorMessage(e, INVITE_REJECTED_MESSAGE));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthFormScreen
      title="Join Cadence"
      subtitle="Use the email your invite was sent to, and the code that came with it."
      error={error}
      footer={
        <Pressable
          accessibilityRole="link"
          onPress={() => router.replace("/sign-in")}
          className="items-center py-3 active:opacity-70"
        >
          <Text className="text-sm text-muted">
            Already have an account? <Text className="font-semibold text-foreground">Sign in</Text>
          </Text>
        </Pressable>
      }
    >
      <AuthTextField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Your full name"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
      />
      <AuthTextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@company.com"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
      />
      <AuthTextField
        label="Invite code"
        value={inviteCode}
        onChangeText={setInviteCode}
        placeholder="ABCD-EFGH"
        hint={`From the admin who invited you. Codes expire after ${INVITE_DAYS} days.`}
        autoCapitalize="characters"
        autoComplete="one-time-code"
        autoCorrect={false}
        textContentType="oneTimeCode"
        returnKeyType="next"
      />
      <AuthTextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="Choose a password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={handleSignUp}
      />
      <PillButton label="Create account" onPress={handleSignUp} isLoading={isSubmitting} />
    </AuthFormScreen>
  );
}
