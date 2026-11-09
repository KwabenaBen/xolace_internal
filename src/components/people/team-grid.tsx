import type { JSX } from "react";
import { Pressable, Text, View } from "react-native";

import { fonts, usePageColors } from "@/components/ui/theme";

import { Avatar, pastelFor } from "./avatar";

export type GridPerson = {
  id: string;
  name: string;
  title: string;
  isAdmin: boolean;
  isYou: boolean;
  /** Read out in full (role, reviewer, …), since the cell shows only first name and title. */
  label: string;
  onPress?: () => void;
};

const COLUMNS = 4;

/**
 * The reference's "Our Experts" panel: a centred heading over a grid of round avatars, four to a
 * row, each with a first name and a title under it. Tapping a person opens their card.
 */
export function TeamGrid({
  s,
  width,
  title,
  people,
}: {
  s: number;
  /** The panel's full width. */
  width: number;
  title: string;
  people: GridPerson[];
}): JSX.Element {
  const c = usePageColors();
  const pad = 16 * s;
  const gap = 8 * s;
  const cell = Math.floor((width - 2 * pad - 2 - (COLUMNS - 1) * gap) / COLUMNS);
  const avatar = Math.min(60 * s, cell - 8);

  return (
    <View
      style={{
        width,
        borderRadius: 30 * s,
        backgroundColor: c.panel,
        borderWidth: 1,
        borderColor: c.hairline,
        paddingHorizontal: pad,
        paddingTop: 18 * s,
        paddingBottom: 22 * s,
        gap: 18 * s,
      }}
    >
      <Text
        accessibilityRole="header"
        maxFontSizeMultiplier={1.3}
        style={{
          textAlign: "center",
          fontFamily: fonts.extraBold,
          fontSize: 18 * s,
          color: c.text,
        }}
      >
        {title}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: gap, rowGap: 18 * s }}>
        {people.map((person) => (
          <Pressable
            key={person.id}
            disabled={person.onPress === undefined}
            onPress={person.onPress}
            accessibilityRole={person.onPress !== undefined ? "button" : undefined}
            accessibilityLabel={person.label}
            accessibilityHint={person.onPress !== undefined ? "Opens their card" : undefined}
            style={({ pressed }) => ({
              width: cell,
              alignItems: "center",
              gap: 8 * s,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Avatar
              size={avatar}
              fill={pastelFor(person.id)}
              name={person.name}
              isAdmin={person.isAdmin}
            />
            <View style={{ alignItems: "center", gap: 1, paddingTop: person.isAdmin ? 2 : 0 }}>
              <Text
                numberOfLines={1}
                maxFontSizeMultiplier={1.3}
                style={{ fontFamily: fonts.semibold, fontSize: 13 * s, color: c.text }}
              >
                {person.isYou ? "You" : (person.name.trim().split(/\s+/)[0] ?? person.name)}
              </Text>
              <Text
                numberOfLines={1}
                maxFontSizeMultiplier={1.3}
                style={{ fontFamily: fonts.medium, fontSize: 11 * s, color: c.muted }}
              >
                {person.title}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
