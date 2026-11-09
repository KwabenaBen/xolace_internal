import { useAuthActions } from "@convex-dev/auth/react";
import { useRouter } from "expo-router";
import { useState, type JSX } from "react";
import { Pressable, Text } from "react-native";

import { MIN_PASSWORD_LENGTH } from "@convex/lib/constants";

import { AuthFormScreen } from "@/components/auth/auth-form-screen";
import { AuthTextField } from "@/components/auth/auth-text-field";
import { PillButton } from "@/components/auth/pill-button";
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
    <AuthFormScreen
      title="Join Cadence"
      subtitle="Use the email address your invite was sent to."
      error={error}
      footer={
        <Pressable
          accessibilityRole="link"
          onPress={() => router.replace("/sign-in")}
          className="items-center py-3 active:opacity-70"
        >
          <Text className="text-sm text-neutral-400">
            Already have an account? <Text className="font-semibold text-white">Sign in</Text>
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
