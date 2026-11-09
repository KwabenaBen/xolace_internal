import type { JSX } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import type { Role } from "@convex/lib/validators";
import { formatInviteCode } from "@convex/lib/inviteCodes";

import { colors, fonts } from "@/components/ui/theme";
import { ROLE_LABELS } from "@/constants/labels";

import { Circled, EnvelopeSticker, Seal, Underlined } from "./stickers";

/**
 * The invite as a ticket, in the person card's style: a lavender sticker card ("You're invited",
 * their email, "as COO" circled, their role underlined, a seal and an envelope). While the admin
 * types it previews the invite; once created it shows the one-time code to send. Black ink on the
 * pastel, the same in both themes.
 */
export function InviteTicket({
  email,
  title,
  role,
  code,
  until,
}: {
  email: string;
  title: string;
  role: Role;
  /** undefined: not created yet; null: created, code loading; a string: the code. */
  code?: string | null;
  /** "Works until 23 Nov", once there's a code. */
  until?: string;
}): JSX.Element {
  const who = email.trim() === "" ? "their email" : email.trim();
  const as = title.trim() === "" ? "their title" : title.trim();
  const roleLabel = ROLE_LABELS[role];
  const muted = { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.ink };

  return (
    <View
      accessible
      accessibilityLabel={`Invite for ${who}, as ${as}, ${roleLabel}.${
        typeof code === "string" ? ` Code ${code.split("").join(" ")}. ${until ?? ""}` : ""
      }`}
      style={{
        borderRadius: 28,
        borderCurve: "continuous",
        backgroundColor: colors.lavender,
        padding: 22,
        gap: 10,
        overflow: "hidden",
      }}
    >
      <View style={{ gap: 6, paddingRight: 84 }}>
        <Text
          style={{ fontFamily: fonts.bold, fontSize: 11, letterSpacing: 2.4, color: colors.ink }}
        >
          CADENCE · INVITE
        </Text>
        <Text
          maxFontSizeMultiplier={1.2}
          style={{ fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, color: colors.ink }}
        >
          You&apos;re invited
        </Text>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: fonts.semibold,
            fontSize: 16,
            color: email.trim() === "" ? colors.ink55Black : colors.ink,
          }}
        >
          {who}
        </Text>
      </View>

      <View
        style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", columnGap: 6 }}
      >
        <Text
          maxFontSizeMultiplier={1.2}
          style={{ fontFamily: fonts.serif, fontSize: 20, lineHeight: 34, color: colors.ink }}
        >
          as
        </Text>
        <Circled text={as} size={19} color={colors.ink} />
        <Underlined text={roleLabel.toUpperCase()} size={30} color={colors.ink} />
      </View>

      <View
        style={{
          marginTop: 4,
          borderRadius: 16,
          borderWidth: 1.5,
          borderStyle: "dashed",
          borderColor: colors.ink55Black,
          paddingVertical: 12,
          paddingLeft: 14,
          paddingRight: 72,
          gap: 2,
          minHeight: 64,
          justifyContent: "center",
        }}
      >
        {code === undefined ? (
          <Text style={muted}>The one-time code appears here when you create the invite.</Text>
        ) : code === null ? (
          <ActivityIndicator color={colors.ink} style={{ alignSelf: "flex-start" }} />
        ) : (
          <>
            <Text
              selectable
              style={{ fontFamily: fonts.black, fontSize: 30, letterSpacing: 3, color: colors.ink }}
            >
              {formatInviteCode(code)}
            </Text>
            {until !== undefined ? <Text style={muted}>{until}</Text> : null}
          </>
        )}
      </View>

      <Seal size={84} words="CADENCE · INVITE ·" rotate={10} style={{ right: 14, top: 14 }} />
      <EnvelopeSticker size={56} rotate={-12} style={{ right: 16, bottom: 18 }} />
    </View>
  );
}
