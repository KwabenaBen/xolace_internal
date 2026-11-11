import type { JSX } from "react";
import { Text, View } from "react-native";

import type { UserSummary } from "@convex/lib/views";

import { Avatar, pastelFor } from "@/components/people/avatar";

import { webType } from "../web-theme";

/**
 * Who's on something, as overlapping avatars (after the reference's "+120" stacks): the first
 * few, then "+N" for the rest. Says who in full to screen readers.
 */
export function AvatarStack({
  people,
  size = 30,
  max = 3,
  countColor,
}: {
  people: readonly UserSummary[];
  size?: number;
  max?: number;
  /** The "+N" text colour (it sits on a sticker or the dark card, not always the page). */
  countColor: string;
}): JSX.Element | null {
  if (people.length === 0) return null;
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <View
      accessible
      accessibilityLabel={`On it: ${people.map((p) => p.name).join(", ")}`}
      style={{ flexDirection: "row", alignItems: "center" }}
    >
      {shown.map((person, i) => (
        <View key={person._id} style={{ marginLeft: i === 0 ? 0 : -size * 0.3, zIndex: max - i }}>
          <Avatar size={size} fill={pastelFor(person._id)} name={person.name} />
        </View>
      ))}
      {rest > 0 ? (
        <Text style={{ ...webType.small, fontWeight: "600", color: countColor, marginLeft: 8 }}>
          +{rest}
        </Text>
      ) : null}
    </View>
  );
}
