import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "expo-router";
import { Button, Description, Input, Label, TextField } from "heroui-native";
import { useState, type JSX } from "react";

import { MIN_PASSWORD_LENGTH } from "@convex/lib/constants";

import { AuthScreen } from "@/components/auth-screen";
import { getErrorMessage } from "@/lib/errors";

export default function SignUpScreen(): JSX.Element {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignUp() {
    if (name.trim().length === 0 || email.trim().length === 0) {
      setError("Enter your name and the email your invite was sent to.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      // The server only creates the account if this email has an unused invite.
      await signIn("password", { name, email, password, flow: "signUp" });
    } catch (e) {
      setError(
        getErrorMessage(
          e,
          "We couldn't create your account. If you already have one, sign in instead."
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreen
      subtitle="Cadence is invite-only. Use the email address your invite was sent to."
      error={error}
      footer={
        <Button variant="ghost" onPress={() => router.replace("/sign-in")}>
          Already have an account? Sign in
        </Button>
      }
    >
      <TextField isRequired>
        <Label>Name</Label>
        <Input
          value={name}
          onChangeText={setName}
          placeholder="Your full name"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
        />
      </TextField>
      <TextField isRequired>
        <Label>Email</Label>
        <Input
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
      </TextField>
      <TextField isRequired>
        <Label>Password</Label>
        <Input
          value={password}
          onChangeText={setPassword}
          placeholder="Choose a password"
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={handleSignUp}
        />
        <Description>At least {MIN_PASSWORD_LENGTH} characters.</Description>
      </TextField>
      <Button onPress={handleSignUp} isDisabled={isSubmitting}>
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>
    </AuthScreen>
  );
}
