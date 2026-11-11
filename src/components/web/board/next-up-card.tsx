import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, JSX } from "react";
import { Pressable, Text, View } from "react-native";

import { calendarDaysBetween, formatDeadline, relativeDay } from "@convex/lib/dates";
import type { FeatureSummary, TaskView } from "@convex/lib/views";

import type { FeatureProgress } from "@/components/board/board-stats";
import { ProgressBar } from "@/components/ui/progress-bar";
import { colors, fonts, usePageColors } from "@/components/ui/theme";

import { useHover } from "../use-hover";
import { webType } from "../web-theme";

import { AvatarStack } from "./avatar-stack";
import { ownersOf } from "./board-filter";

/**
 * The feature that needs attention next, after the reference's dark "new course" card: the near-
 * black card in both themes, a yellow tag with when it's due (red when late), the title, its
 * progress, who's on it, and an orange button to the feature page. With nothing planned, it says
 * so (and admins get "New feature").
 */
export function NextUpCard({
  next,
  tasks,
  now,
  isAdmin,
  onOpen,
  onNewFeature,
}: {
  next: { feature: FeatureSummary; progress: FeatureProgress } | null;
  tasks: readonly TaskView[];
  now: number;
  isAdmin: boolean;
  onOpen: () => void;
  onNewFeature: () => void;
}): JSX.Element {
  const c = usePageColors();
  const late = next !== null && calendarDaysBetween(now, next.feature.deadline) < 0;

  return (
    <View
      style={{
        borderRadius: 22,
        borderWidth: 1,
        borderColor: c.hairline,
        backgroundColor: colors.holoCard,
        padding: 24,
        gap: 18,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ ...webType.small, color: colors.ink75White }}>Next up</Text>
        {next !== null ? (
          <View
            style={{
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 5,
              backgroundColor: late ? colors.red : colors.yellow,
            }}
          >
            <Text style={{ ...webType.tiny, fontWeight: "700", color: colors.black }}>
              {late
                ? relativeDay(next.feature.deadline, now)
                : `Due ${formatDeadline(next.feature.deadline, now)}`}
            </Text>
          </View>
        ) : null}
      </View>

      {next === null ? (
        <>
          <Text
            style={{
              fontFamily: fonts.extraBold,
              fontSize: 26,
              lineHeight: 32,
              letterSpacing: -0.6,
              color: colors.white,
            }}
          >
            Nothing planned yet
          </Text>
          <Text style={{ ...webType.body, color: colors.ink75White }}>
            {isAdmin
              ? "Add a feature after the meeting, then its tasks."
              : "The admin adds features after each meeting."}
          </Text>
          {isAdmin ? <OrangeButton label="New feature" icon="add" onPress={onNewFeature} /> : null}
        </>
      ) : (
        <>
          <Text
            numberOfLines={3}
            style={{
              fontFamily: fonts.extraBold,
              fontSize: 28,
              lineHeight: 34,
              letterSpacing: -0.7,
              color: colors.white,
            }}
          >
            {next.feature.title}
          </Text>
          <View style={{ gap: 8 }}>
            <Text style={{ ...webType.small, color: colors.ink75White }}>
              <Text style={{ fontWeight: "700", color: colors.white }}>
                {next.progress.percent}%
              </Text>{" "}
              done · {next.progress.verified}/{next.progress.total} verified
              {late ? "" : ` · ${relativeDay(next.feature.deadline, now)}`}
            </Text>
            <ProgressBar
              percent={next.progress.percent}
              height={6}
              track={colors.panel12}
              fill={colors.yellow}
            />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={{ ...webType.small, color: colors.ink75White }}>On it</Text>
            <AvatarStack people={ownersOf(tasks)} size={30} max={4} countColor={colors.white} />
          </View>
          <OrangeButton label="Open feature" icon="arrow-forward" onPress={onOpen} />
        </>
      )}
    </View>
  );
}

function OrangeButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
}): JSX.Element {
  const [hovered, hover] = useHover();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      {...hover}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: 48,
        borderRadius: 999,
        backgroundColor: colors.orange,
        opacity: hovered ? 0.9 : 1,
      }}
      className="active:opacity-70"
    >
      <Text style={{ ...webType.body, fontWeight: "700", color: colors.black }}>{label}</Text>
      <Ionicons name={icon} size={16} color={colors.black} />
    </Pressable>
  );
}
