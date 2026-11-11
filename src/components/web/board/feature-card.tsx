import { Ionicons } from "@expo/vector-icons";
import type { JSX } from "react";
import { Pressable, Text, View } from "react-native";

import { calendarDaysBetween, formatDeadline, relativeDay } from "@convex/lib/dates";

import { featureProgress, plural, type BoardGroup } from "@/components/board/board-stats";
import { pastelFor } from "@/components/people/avatar";
import { ProgressBar } from "@/components/ui/progress-bar";
import { colors, fonts } from "@/components/ui/theme";
import { FEATURE_STATUS_LABELS } from "@/constants/labels";

import { useHover } from "../use-hover";
import { webType } from "../web-theme";

import { AvatarStack } from "./avatar-stack";
import { ownersOf } from "./board-filter";

/**
 * One feature on the web Board, after the reference's course cards: a pastel sticker with an ink
 * outline, its stage and deadline, the title, how many tasks are verified with a progress bar,
 * who's on it, and an orange "Open". The whole card opens the feature page. Stickers keep their
 * colours in both themes, with ink text.
 */
export function FeatureCard({
  group,
  now,
  onOpen,
}: {
  group: BoardGroup;
  now: number;
  onOpen: () => void;
}): JSX.Element {
  const { feature, tasks } = group;
  const [hovered, hover] = useHover();
  const progress = featureProgress(tasks);
  const owners = ownersOf(tasks);
  const late = feature.status !== "shipped" && calendarDaysBetween(now, feature.deadline) < 0;
  const due = feature.status === "shipped" ? "Shipped" : relativeDay(feature.deadline, now);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${feature.title}: ${FEATURE_STATUS_LABELS[feature.status]}, due ${formatDeadline(feature.deadline, now)} (${due}), ${progress.verified} of ${plural(progress.total, "task")} verified`}
      onPress={onOpen}
      {...hover}
      style={{
        flex: 1,
        minHeight: 236,
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: colors.ink,
        backgroundColor: pastelFor(feature._id),
        padding: 20,
        gap: 14,
        boxShadow: hovered ? `4px 4px 0 ${colors.ink}` : "0 0 0 transparent",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View
          style={{
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 5,
            backgroundColor: colors.tagFill,
            borderWidth: 1,
            borderColor: colors.ink,
          }}
        >
          <Text style={{ ...webType.tiny, fontWeight: "600", color: colors.ink }}>
            {FEATURE_STATUS_LABELS[feature.status]}
          </Text>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 5,
            backgroundColor: late ? colors.lateCard : "transparent",
          }}
        >
          <Ionicons
            name={late ? "alert-circle" : "calendar-clear-outline"}
            size={13}
            color={late ? colors.white : colors.ink}
          />
          <Text
            style={{ ...webType.tiny, fontWeight: "600", color: late ? colors.white : colors.ink }}
          >
            {due}
          </Text>
        </View>
      </View>

      <Text
        numberOfLines={2}
        style={{
          fontFamily: fonts.extraBold,
          fontSize: 22,
          lineHeight: 27,
          letterSpacing: -0.5,
          color: colors.ink,
          minHeight: 54,
        }}
      >
        {feature.title}
      </Text>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ ...webType.small, color: colors.ink }}>
            Progress <Text style={{ fontWeight: "700" }}>{progress.percent}%</Text>
          </Text>
          <Text style={{ ...webType.small, color: colors.ink }}>
            <Text style={{ fontWeight: "700" }}>
              {progress.verified}/{progress.total}
            </Text>{" "}
            verified
          </Text>
        </View>
        <ProgressBar
          percent={progress.percent}
          height={8}
          track="rgba(17,17,17,0.14)"
          fill={colors.ink}
        />
      </View>

      <View
        style={{
          marginTop: "auto",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        {owners.length > 0 ? (
          <AvatarStack people={owners} size={30} countColor={colors.ink} />
        ) : (
          <Text style={{ ...webType.small, color: colors.ink }}>No tasks yet</Text>
        )}
        <View
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            borderRadius: 999,
            paddingHorizontal: 16,
            paddingVertical: 9,
            backgroundColor: colors.orange,
            borderWidth: 1.5,
            borderColor: colors.ink,
          }}
        >
          <Text style={{ ...webType.small, fontWeight: "700", color: colors.ink }}>Open</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.ink} />
        </View>
      </View>
    </Pressable>
  );
}
