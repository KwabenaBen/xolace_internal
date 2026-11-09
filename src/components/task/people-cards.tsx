import type { JSX } from "react";
import { Text, View } from "react-native";

import type { UserSummary } from "@convex/lib/views";

import { fonts } from "@/components/board/board-theme";

import { taskColors } from "./task-theme";

export type PersonCard = {
  /** "Owner", "Peer reviewer", "Proposed by". */
  role: string;
  user: UserSummary | null;
  /** Shown when `user` is null, e.g. "Unassigned". */
  fallback: string;
  color: string;
  /** The small white tag top-right, e.g. the priority. */
  tag?: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/**
 * Who's on the task, as the reference's "Your plan" pastel cards: two to a row, an odd one out
 * full width. Black ink on the pastel, a black initials badge in place of the reference's photo.
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

  return (
    <View style={{ gap: 12 * s }}>
      <Text
        accessibilityRole="header"
        allowFontScaling={false}
        style={{
          fontFamily: fonts.extraBold,
          fontSize: 18 * s,
          color: taskColors.white,
          paddingHorizontal: 4,
        }}
      >
        Who&apos;s on it
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
        {people.map((person, index) => {
          const alone = index === people.length - 1 && people.length % 2 === 1;
          return <Card key={person.role} person={person} s={s} width={alone ? width : half} />;
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
  const spoken = [
    `${person.role}: ${name}`,
    user !== null && user.title !== "" ? user.title : null,
    tag ?? null,
  ]
    .filter((part) => part !== null)
    .join(", ");

  return (
    <View
      accessible
      accessibilityLabel={spoken}
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
            backgroundColor: user === null ? "rgba(17,17,17,0.18)" : taskColors.ink,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            allowFontScaling={false}
            style={{ fontFamily: fonts.extraBold, fontSize: 14 * s, color: taskColors.white }}
          >
            {user === null ? "–" : initials(user.name)}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        {tag !== undefined ? (
          <View
            style={{
              borderRadius: 999,
              backgroundColor: taskColors.tagFill,
              paddingHorizontal: 10 * s,
              paddingVertical: 4 * s,
              flexShrink: 1,
            }}
          >
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={{ fontFamily: fonts.bold, fontSize: 11 * s, color: taskColors.ink }}
            >
              {tag}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ gap: 2 }}>
        <Text
          allowFontScaling={false}
          style={{
            fontFamily: fonts.bold,
            fontSize: 11 * s,
            letterSpacing: 0.8,
            color: "rgba(17,17,17,0.6)",
          }}
        >
          {person.role.toUpperCase()}
        </Text>
        <Text
          allowFontScaling={false}
          numberOfLines={2}
          style={{
            fontFamily: fonts.extraBold,
            fontSize: 17 * s,
            letterSpacing: -0.3,
            color: taskColors.ink,
          }}
        >
          {name}
        </Text>
        {user !== null && user.title !== "" ? (
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={{ fontFamily: fonts.medium, fontSize: 13 * s, color: "rgba(17,17,17,0.7)" }}
          >
            {user.title}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
