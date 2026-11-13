import { useEffect, type JSX } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Role } from "@convex/lib/validators";
import { MONTH_NAMES } from "@convex/lib/dates";

import { FormError } from "@/components/planning/form-error";
import { initials } from "@/components/task/people-cards";
import { Sheet, SheetScrollView, useSheet } from "@/components/ui/sheet";
import { Sym, symbols } from "@/components/ui/sym";
import { colors, fonts, usePageColors } from "@/components/ui/theme";
import { useSheetActions, type SheetAction } from "@/components/ui/use-sheet-actions";
import { ROLE_LABELS } from "@/constants/labels";

import { pastelFor } from "./avatar";
import { CheckStamp, Circled, EnvelopeSticker, HeartSticker, Seal, Underlined } from "./stickers";

export type CardPerson = {
  _id: string;
  _creationTime: number;
  name: string;
  title: string;
  email: string;
  role: Role;
  isActive: boolean;
  timezone: string;
};

/** "Nov 2026", in GMT like every date in Cadence. */
function monthYear(ms: number): string {
  const d = new Date(ms);
  return `${MONTH_NAMES.short[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** One of the card's options: a solid block like the reference's "Shop here" button. */
function CardButton({
  label,
  hint,
  tone,
  isDisabled,
  onPress,
}: {
  label: string;
  hint?: string;
  tone: "primary" | "danger" | "quiet";
  isDisabled?: boolean;
  onPress: () => void;
}): JSX.Element {
  const c = usePageColors();
  const fill = tone === "danger" ? colors.lateCard : tone === "primary" ? c.text : "transparent";
  const ink = tone === "danger" ? colors.white : tone === "primary" ? c.page : c.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: isDisabled === true }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => ({
        height: 54,
        borderRadius: 12,
        backgroundColor: fill,
        borderWidth: tone === "quiet" ? 1.5 : 0,
        borderColor: c.hairline,
        alignItems: "center",
        justifyContent: "center",
        opacity: isDisabled === true ? 0.5 : pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: fonts.bold,
          fontSize: 14,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: ink,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * A person's card on the People page, after the reference's editorial phone: their pastel with big
 * initials and stickers (a seal with their role, an envelope, a heart on your own card, a green
 * stamp for the admin task reviewer), then "Kofi is a MEMBER" in a serif with pen marks, their
 * details, and their options beneath (admins only), which ask first inside the card. It opens in
 * a Sheet: it rises over the blurred People page; swipe it down, or tap ✕ or outside it, to close.
 */
export function PersonCard({
  onClose,
  ...props
}: {
  person: CardPerson;
  isYou: boolean;
  isReviewer: boolean;
  actions: readonly SheetAction[];
  /** "Daily logs": called before the card closes; the page opens their logs once it has. */
  onOpenLogs: () => void;
  onClose: () => void;
}): JSX.Element {
  const c = usePageColors();
  return (
    <Sheet onClose={onClose} backgroundColor={c.page} grabberColor={colors.closeFill}>
      <PersonCardBody {...props} />
    </Sheet>
  );
}

function PersonCardBody({
  person,
  isYou,
  isReviewer,
  actions,
  onOpenLogs,
}: {
  person: CardPerson;
  isYou: boolean;
  isReviewer: boolean;
  actions: readonly SheetAction[];
  onOpenLogs: () => void;
}): JSX.Element {
  const c = usePageColors();
  const insets = useSafeAreaInsets();
  const sheet = useSheet();
  const { asking, busy, error, choose, run, back, close } = useSheetActions(sheet.close);
  const { setLocked } = sheet;

  // No swiping it away while an option is saving.
  useEffect(() => setLocked(busy), [busy, setLocked]);

  const first = person.name.trim().split(/\s+/)[0] ?? person.name;
  const role = ROLE_LABELS[person.role];
  const lead = isYou
    ? `You're ${person.role === "admin" ? "an" : "a"}`
    : `${first} ${person.isActive ? "is" : "was"} ${person.role === "admin" ? "an" : "a"}`;
  const heroH = 300;

  return (
    <SheetScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
      {/* the "photo": their pastel, big initials, stickers */}
      <View
        style={{
          height: heroH,
          backgroundColor: pastelFor(person._id),
          overflow: "hidden",
        }}
      >
        <View
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            opacity: person.isActive ? 1 : 0.4,
          }}
        >
          <Text
            style={{
              fontFamily: fonts.black,
              fontSize: 132,
              letterSpacing: -6,
              color: colors.ink,
              transform: [{ rotate: "-5deg" }],
            }}
          >
            {initials(person.name)}
          </Text>
        </View>

        <Seal
          size={96}
          words={`CADENCE · ${role.toUpperCase()} ·`}
          style={{ right: 16, top: 18 }}
        />
        <EnvelopeSticker size={58} style={{ right: 34, top: 132 }} />
        {isReviewer ? <CheckStamp size={70} style={{ left: 18, bottom: 22 }} /> : null}
        {isYou ? <HeartSticker size={74} style={{ right: 22, bottom: 8 }} /> : null}
        {!person.isActive ? (
          <View
            aria-hidden
            style={{
              position: "absolute",
              left: 40,
              top: heroH / 2 - 18,
              backgroundColor: colors.cream,
              paddingHorizontal: 18,
              paddingVertical: 8,
              transform: [{ rotate: "-8deg" }],
            }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 15, letterSpacing: 2 }}>
              SIGNED OUT
            </Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={8}
          onPress={close}
          style={({ pressed }) => ({
            position: "absolute",
            left: 16,
            top: 16,
            width: 40,
            height: 40,
            borderRadius: 999,
            backgroundColor: colors.tagFill,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Sym symbol={symbols.close} size={16} color={colors.ink} weight="bold" />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 22, paddingTop: 24, gap: 18 }}>
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel={`${person.name}${isYou ? " (you)" : ""}. ${role}${
            person.isActive ? "" : ", deactivated"
          }. ${person.title}, on the team since ${monthYear(person._creationTime)}.`}
          style={{ gap: 10 }}
        >
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "flex-end",
              columnGap: 10,
            }}
          >
            <Text
              maxFontSizeMultiplier={1.2}
              style={{
                fontFamily: fonts.serif,
                fontSize: 32,
                lineHeight: 40,
                color: c.text,
              }}
            >
              {lead}
            </Text>
            <Underlined text={role.toUpperCase()} size={40} color={c.text} />
          </View>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              columnGap: 4,
            }}
          >
            <Circled text={person.title} size={21} color={c.text} />
            <Text
              maxFontSizeMultiplier={1.2}
              style={{ fontFamily: fonts.serif, fontSize: 21, color: c.text }}
            >
              since {monthYear(person._creationTime)}
            </Text>
          </View>
        </View>

        <View style={{ gap: 4 }}>
          <Text selectable style={{ fontFamily: fonts.semibold, fontSize: 14, color: c.text }}>
            {person.email}
          </Text>
          <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: c.muted }}>
            Time zone {person.timezone}
          </Text>
          {isReviewer ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: c.muted }}>
              Admin task reviewer: verifies the tasks admins own.
            </Text>
          ) : null}
          {!person.isActive ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: c.muted }}>
              Deactivated: signed out everywhere until an admin reactivates them.
            </Text>
          ) : null}
        </View>

        {asking?.confirm !== undefined ? (
          <View style={{ gap: 12 }}>
            <Text
              accessibilityRole="header"
              style={{ fontFamily: fonts.serif, fontSize: 24, color: c.text }}
            >
              {asking.confirm.title}
            </Text>
            <Text
              style={{
                fontFamily: fonts.medium,
                fontSize: 14,
                lineHeight: 21,
                color: c.muted,
              }}
            >
              {asking.confirm.message}
            </Text>
            <FormError message={error} />
            <CardButton
              label={busy ? "Working…" : asking.confirm.label}
              tone={asking.destructive === true ? "danger" : "primary"}
              isDisabled={busy}
              onPress={() => void run(asking)}
            />
            <CardButton label="Not now" tone="quiet" isDisabled={busy} onPress={back} />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {/* Everyone can read everyone's logs. */}
            <CardButton
              label={isYou ? "Your daily logs" : "Daily logs"}
              hint={isYou ? undefined : `${first}'s logs and missed weekdays`}
              tone="quiet"
              isDisabled={busy}
              onPress={() => {
                onOpenLogs();
                close();
              }}
            />
            {actions.length > 0 ? <FormError message={error} /> : null}
            {actions.map((action) => (
              <CardButton
                key={action.key}
                label={action.label}
                hint={action.description}
                tone={action.destructive === true ? "danger" : "primary"}
                isDisabled={busy}
                onPress={() => choose(action)}
              />
            ))}
          </View>
        )}
      </View>
    </SheetScrollView>
  );
}
