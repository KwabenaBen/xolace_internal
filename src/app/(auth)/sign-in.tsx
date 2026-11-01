import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "expo-router";
import { Button, Input, Label, TextField } from "heroui-native";
import { useState, type JSX } from "react";

import { AuthScreen } from "@/components/auth-screen";
import { getErrorMessage } from "@/lib/errors";

export default function SignInScreen(): JSX.Element {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignIn() {
    if (email.trim().length === 0 || password.length === 0) {
      setError("Enter your email and password.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      // On success the root layout's auth guard switches to the app.
      await signIn("password", { email, password, flow: "signIn" });
    } catch (e) {
      setError(getErrorMessage(e, "That email and password don't match an account."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreen
      subtitle="Sign in to see the team's features, tasks and logs."
      error={error}
      footer={
        <Button variant="ghost" onPress={() => router.replace("/sign-up")}>
          Have an invite? Create your account
        </Button>
      }
    >
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
          placeholder="Your password"
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={handleSignIn}
        />
      </TextField>
      <Button onPress={handleSignIn} isDisabled={isSubmitting}>
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>
    </AuthScreen>
  );
}
