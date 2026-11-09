import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "expo-router";
import { useState, type JSX } from "react";
import { Pressable, Text } from "react-native";

import { AuthFormScreen } from "@/components/auth/auth-form-screen";
import { AuthTextField } from "@/components/auth/auth-text-field";
import { PillButton } from "@/components/auth/pill-button";
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
    <AuthFormScreen
      title="Sign in"
      subtitle="Welcome back. Pick up where the team left off."
      error={error}
      footer={
        <Pressable
          accessibilityRole="link"
          onPress={() => router.replace("/sign-up")}
          className="items-center py-3 active:opacity-70"
        >
          <Text className="text-sm text-neutral-400">
            Have an invite? <Text className="font-semibold text-white">Create your account</Text>
          </Text>
        </Pressable>
      }
    >
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
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="Your password"
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={handleSignIn}
      />
      <PillButton label="Sign in" onPress={handleSignIn} isLoading={isSubmitting} />
    </AuthFormScreen>
  );
}
