import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { Stack } from "expo-router";
import { Button, Description, Input, Label, TextField, Typography } from "heroui-native";
import { useState, type JSX } from "react";
import { Pressable, Share, Text, View } from "react-native";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { formatDeadline } from "@convex/lib/dates";
import type { Role } from "@convex/lib/validators";

import { FormError } from "@/components/planning/form-error";
import { useUnsavedGuard } from "@/components/planning/use-unsaved-guard";
import { Screen } from "@/components/screen";
import { fonts, usePageColors } from "@/components/ui/theme";
import { copyText } from "@/lib/copy-text";
import { getErrorMessage } from "@/lib/errors";
import { useNow } from "@/lib/use-now";

import { hasLiveCode, inviteMessage } from "./invite-actions";
import { InviteTicket } from "./invite-ticket";

export type InviteValues = { email: string; title: string; role: Role };

const EMPTY: InviteValues = { email: "", title: "", role: "member" };

const ROLES: { value: Role; label: string; description: string }[] = [
  {
    value: "member",
    label: "Member",
    description: "Works on their tasks and proposes new ones.",
  },
  {
    value: "admin",
    label: "Admin",
    description: "Plans features, assigns and approves work, manages the team.",
  },
];

/** One of the two roles, as a card to pick. */
function RoleCard({
  label,
  description,
  selected,
  onPress,
}: {
  label: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}): JSX.Element {
  const c = usePageColors();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      accessibilityHint={description}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        borderRadius: 18,
        borderCurve: "continuous",
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? c.text : c.hairline,
        backgroundColor: c.panel,
        padding: 14,
        gap: 6,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: c.text }}>{label}</Text>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 999,
            borderWidth: selected ? 0 : 1.5,
            borderColor: c.hairline,
            backgroundColor: selected ? c.text : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {selected ? <Ionicons name="checkmark" size={15} color={c.page} /> : null}
        </View>
      </View>
      <Text style={{ fontFamily: fonts.medium, fontSize: 12, lineHeight: 17, color: c.muted }}>
        {description}
      </Text>
    </Pressable>
  );
}

/**
 * Invite someone (admins). A ticket at the top previews the invite as it's typed: their email,
 * title and role (picked from two cards). Create makes the invite and its one-time code; the same
 * screen then shows the code on the ticket, with Share (the phone's share sheet) and Done, so it
 * can be sent straight away. The server re-checks everything (a valid email, no account or
 * pending invite for it already).
 */
export function InviteForm({
  onCreate,
  onDone,
}: {
  onCreate: (values: InviteValues) => Promise<Id<"invites">>;
  onDone: () => void;
}): JSX.Element {
  const c = usePageColors();
  const now = useNow();
  const [values, setValues] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<Id<"invites"> | null>(null);
  const [copied, setCopied] = useState(false);
  const guard = useUnsavedGuard(EMPTY, values);
  // After creating, the new invite (with its code) from the admin's invite list.
  const invites = useQuery(api.invites.list, createdId !== null ? {} : "skip");
  const created = invites?.find((i) => i._id === createdId);

  async function submit() {
    if (!values.email.includes("@") || values.title.trim() === "") {
      setError("Add their email address and their title.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    guard.markSaving();
    try {
      setCreatedId(await onCreate(values));
    } catch (e) {
      setError(getErrorMessage(e));
      guard.markFailed();
    } finally {
      setIsSubmitting(false);
    }
  }

  if (createdId !== null) {
    const live = created !== undefined && hasLiveCode(created, now);
    const until =
      created?.expiresAt !== undefined
        ? `Works until ${formatDeadline(created.expiresAt, now)}.`
        : undefined;
    return (
      <Screen
        withHeader
        dialogTitle="Invite ready"
        footer={
          <View className="gap-3">
            {created !== undefined && live ? (
              process.env.EXPO_OS !== "web" ? (
                <Button
                  onPress={() => {
                    Share.share({ message: inviteMessage(created, now) }).catch(() => {});
                  }}
                >
                  Share code
                </Button>
              ) : (
                <Button
                  onPress={() => {
                    void copyText(inviteMessage(created, now)).then(setCopied);
                  }}
                >
                  {copied ? "Copied" : "Copy invite"}
                </Button>
              )
            ) : null}
            <Button variant={live ? "secondary" : "primary"} onPress={onDone}>
              Done
            </Button>
          </View>
        }
      >
        {/* No Cancel once it's made: Done (or a swipe down) goes back to People. */}
        <Stack.Screen options={{ title: "Invite ready", headerLeft: () => null }} />
        <InviteTicket
          email={values.email}
          title={values.title}
          role={values.role}
          code={live ? (created?.code ?? null) : null}
          until={until}
        />
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, lineHeight: 21, color: c.muted }}>
          Send them this code. They join Cadence with {values.email.trim()} and the code; it works
          once. It&apos;s also on the People page, under Waiting to join.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen
      withHeader
      dialogTitle="Invite someone"
      footer={
        <View className="gap-3">
          <FormError message={error} />
          <Button onPress={submit} isDisabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create invite"}
          </Button>
        </View>
      }
    >
      <InviteTicket email={values.email} title={values.title} role={values.role} />
      <TextField isRequired>
        <Label>Email</Label>
        <Input
          value={values.email}
          onChangeText={(email) => setValues((v) => ({ ...v, email }))}
          placeholder="name@company.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          textContentType="none"
        />
        <Description>They sign up with this email and the code you send them.</Description>
      </TextField>
      <TextField isRequired>
        <Label>Title</Label>
        <Input
          value={values.title}
          onChangeText={(title) => setValues((v) => ({ ...v, title }))}
          placeholder="e.g. COO"
        />
      </TextField>
      <View className="gap-1.5">
        <Typography type="body-sm" weight="medium">
          Role
        </Typography>
        <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 10 }}>
          {ROLES.map((r) => (
            <RoleCard
              key={r.value}
              label={r.label}
              description={r.description}
              selected={values.role === r.value}
              onPress={() => setValues((v) => ({ ...v, role: r.value }))}
            />
          ))}
        </View>
      </View>
    </Screen>
  );
}
