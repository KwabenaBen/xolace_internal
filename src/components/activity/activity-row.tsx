import type { JSX } from "react";
import { Pressable, Text, View } from "react-native";

import { Avatar, pastelFor } from "@/components/people/avatar";
import { Sym, symbols } from "@/components/ui/sym";
import { colors, fonts, usePageColors } from "@/components/ui/theme";

import { describeActivity, timeAgo, type ActivityItem } from "./describe";

/**
 * One activity entry: who (their pastel avatar, or a yellow clock for Cadence itself), the
 * sentence, when, and anything they wrote: a comment as a bubble, a note or reason as a quote.
 * On a task page the task is "it"; in the team feed it's named and the row opens it.
 */
export function ActivityRow({
  item,
  inTask,
  now,
  onPress,
}: {
  item: ActivityItem;
  inTask: boolean;
  now: number;
  onPress?: () => void;
}): JSX.Element {
  const c = usePageColors();
  const { who, what, quote, tone } = describeActivity(item, { inTask, now });
  const when = timeAgo(item.timestamp, now);

  return (
    <Pressable
      disabled={onPress === undefined}
      onPress={onPress}
      accessibilityRole={onPress !== undefined ? "button" : undefined}
      accessibilityLabel={`${who} ${what}, ${when}.${quote !== undefined ? ` “${quote}”` : ""}`}
      accessibilityHint={onPress !== undefined ? "Opens the task" : undefined}
      style={({ pressed }) => ({
        flexDirection: "row",
        gap: 12,
        paddingVertical: 10,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {item.actor !== null ? (
        <Avatar size={34} fill={pastelFor(item.actor._id)} name={item.actor.name} />
      ) : (
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            backgroundColor: colors.yellow,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Sym symbol={symbols.system} size={15} color={colors.ink} />
        </View>
      )}
      <View style={{ flex: 1, gap: 6 }}>
        <Text
          maxFontSizeMultiplier={1.4}
          style={{ fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: c.text }}
        >
          <Text style={{ fontFamily: fonts.bold }}>{who}</Text> {what}
          <Text style={{ color: c.muted }}> · {when}</Text>
        </Text>
        {quote !== undefined ? (
          tone === "comment" ? (
            <View
              style={{
                alignSelf: "flex-start",
                maxWidth: "100%",
                borderRadius: 18,
                borderTopLeftRadius: 6,
                backgroundColor: c.panelRaised,
                paddingHorizontal: 14,
                paddingVertical: 10,
              }}
            >
              <Text
                selectable
                maxFontSizeMultiplier={1.4}
                style={{ fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, color: c.text }}
              >
                {quote}
              </Text>
            </View>
          ) : (
            <View
              style={{
                borderLeftWidth: 3,
                borderLeftColor: tone === "warning" ? colors.yellow : c.hairline,
                paddingLeft: 10,
              }}
            >
              <Text
                selectable
                maxFontSizeMultiplier={1.4}
                style={{ fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: c.muted }}
              >
                {quote}
              </Text>
            </View>
          )
        ) : null}
      </View>
    </Pressable>
  );
}
