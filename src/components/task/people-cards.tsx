import type { JSX } from "react";
import { Pressable, Text, View } from "react-native";

import type { UserSummary } from "@convex/lib/views";

import { ProgressBar } from "@/components/ui/progress-bar";
import { colors, fonts, usePageColors } from "@/components/ui/theme";

export type PersonCard = {
  /** A unique key when the same role appears more than once (e.g. the user's id). */
  id?: string;
  /** "Owner", "Peer reviewer", "Proposed by". */
  role: string;
  user: UserSummary | null;
  /** Shown when `user` is null, e.g. "Unassigned". */
  fallback: string;
  color: string;
  /** The small white tag top-right, e.g. the priority. */
  tag?: string;
  /** 0–100: adds a progress bar along the bottom. */
  progress?: number;
  /** Makes the card a button (e.g. open their work on a feature). */
  onPress?: () => void;
  /** What pressing does, for screen readers. */
  hint?: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/**
 * Who's on a task or feature, as the reference's "Your plan" pastel cards: two to a row, an odd
 * one out full width. Black ink on the pastel, a black initials badge in place of the reference's
 * photo.
 */
export function PeopleCards({
  width,
  s,
  people,
}: {
  width: number;
  s: number;
  people: PersonCard[];
}): JSX.Element {
  const gap = 12 * s;
  const half = (width - gap) / 2;
  const c = usePageColors();

  return (
    <View style={{ gap: 12 * s }}>
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={1.3}
        style={{
          fontFamily: fonts.extraBold,
          fontSize: 18 * s,
          color: c.text,
          paddingHorizontal: 4,
        }}
      >
        Who&apos;s on it
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
        {people.map((person, index) => {
          const alone = index === people.length - 1 && people.length % 2 === 1;
          return (
            <Card
              key={person.id ?? person.role}
              person={person}
              s={s}
              width={alone ? width : half}
            />
          );
        })}
      </View>
    </View>
  );
}

function Card({ person, s, width }: { person: PersonCard; s: number; width: number }): JSX.Element {
  const { user } = person;
  const name = user?.name ?? person.fallback;
  const left = user !== null && !user.isActive;
  const tag = left ? "Deactivated" : person.tag;
  const Shell = person.onPress !== undefined ? Pressable : View;
  const spoken = [
    `${person.role}: ${name}`,
    user !== null && user.title !== "" ? user.title : null,
    tag ?? null,
    person.progress !== undefined ? `progress ${Math.round(person.progress)} percent` : null,
  ]
    .filter((part) => part !== null)
    .join(", ");

  return (
    // A plain view unless it does something, so screen readers don't call it a dimmed button.
    <Shell
      accessible
      accessibilityRole={person.onPress !== undefined ? "button" : undefined}
      accessibilityLabel={spoken}
      accessibilityHint={person.hint}
      onPress={person.onPress}
      className={person.onPress !== undefined ? "active:opacity-80" : undefined}
      style={{
        width,
        minHeight: 132 * s,
        borderRadius: 26 * s,
        backgroundColor: person.color,
        padding: 14 * s,
        justifyContent: "space-between",
        gap: 14 * s,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
        <View
          style={{
            width: 38 * s,
            height: 38 * s,
            borderRadius: 999,
            backgroundColor: user === null ? "rgba(17,17,17,0.18)" : colors.ink,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            maxFontSizeMultiplier={1.3}
            style={{ fontFamily: fonts.extraBold, fontSize: 14 * s, color: colors.white }}
          >
            {user === null ? "–" : initials(user.name)}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        {tag !== undefined ? (
          <View
            style={{
              borderRadius: 999,
              backgroundColor: colors.tagFill,
              paddingHorizontal: 10 * s,
              paddingVertical: 4 * s,
              flexShrink: 1,
            }}
          >
            <Text
              maxFontSizeMultiplier={1.3}
              numberOfLines={1}
              style={{ fontFamily: fonts.bold, fontSize: 11 * s, color: colors.ink }}
            >
              {tag}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ gap: 2 }}>
        <Text
          maxFontSizeMultiplier={1.3}
          style={{
            fontFamily: fonts.bold,
            fontSize: 11 * s,
            letterSpacing: 0.8,
            color: "rgba(17,17,17,0.78)",
          }}
        >
          {person.role.toUpperCase()}
        </Text>
        <Text
          maxFontSizeMultiplier={1.3}
          numberOfLines={2}
          style={{
            fontFamily: fonts.extraBold,
            fontSize: 17 * s,
            letterSpacing: -0.3,
            color: colors.ink,
          }}
        >
          {name}
        </Text>
        {user !== null && user.title !== "" ? (
          <Text
            maxFontSizeMultiplier={1.3}
            numberOfLines={1}
            style={{ fontFamily: fonts.medium, fontSize: 13 * s, color: "rgba(17,17,17,0.8)" }}
          >
            {user.title}
          </Text>
        ) : null}
        {person.progress !== undefined ? (
          <View style={{ marginTop: 8 * s, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ProgressBar
              style={{ flex: 1 }}
              percent={Math.max(0, Math.min(100, Math.round(person.progress)))}
              height={6 * s}
              track={"rgba(17,17,17,0.14)"}
              fill={colors.ink}
            />
            <Text
              maxFontSizeMultiplier={1.3}
              style={{ fontFamily: fonts.extraBold, fontSize: 12 * s, color: colors.ink }}
            >
              {Math.round(person.progress)}%
            </Text>
          </View>
        ) : null}
      </View>
    </Shell>
  );
}
