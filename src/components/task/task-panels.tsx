import type { JSX } from "react";
import { Text, View } from "react-native";

import { Panel } from "@/components/ui/panel";
import { Sym } from "@/components/ui/sym";
import { colors, fonts, usePageColors } from "@/components/ui/theme";

import { CriteriaList } from "./criteria-list";
import { taskSymbols } from "./task-symbols";

/** The acceptance criteria as a checklist; all ticked once the task is verified. */
export function CriteriaCard({
  s,
  criteria,
  suggested,
  verified,
}: {
  s: number;
  criteria: string[];
  /** A proposal's criteria are only suggestions until it's approved. */
  suggested: boolean;
  verified: boolean;
}): JSX.Element {
  const c = usePageColors();
  return (
    <Panel
      s={s}
      title={suggested ? "Suggested acceptance criteria" : "Acceptance criteria"}
      aside={
        criteria.length > 0 ? (
          <View
            style={{
              minWidth: 26 * s,
              borderRadius: 999,
              backgroundColor: colors.lavender,
              paddingHorizontal: 8 * s,
              paddingVertical: 3 * s,
              alignItems: "center",
            }}
          >
            <Text
              maxFontSizeMultiplier={1.3}
              style={{ fontFamily: fonts.extraBold, fontSize: 12 * s, color: colors.ink }}
            >
              {criteria.length}
            </Text>
          </View>
        ) : null
      }
    >
      {criteria.length === 0 ? (
        <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: c.muted }}>None yet.</Text>
      ) : (
        <CriteriaList criteria={criteria} verified={verified} size="large" s={s} />
      )}
    </Panel>
  );
}

export function DescriptionCard({
  s,
  text,
  title = "Description",
}: {
  s: number;
  text: string;
  title?: string;
}): JSX.Element {
  const c = usePageColors();
  return (
    <Panel s={s} title={title}>
      <Text
        selectable
        style={{
          fontFamily: fonts.medium,
          fontSize: 15,
          lineHeight: 22,
          color: c.text,
        }}
      >
        {text}
      </Text>
    </Panel>
  );
}

/**
 * A short notice above the countdown: "declined" in the late red with the admin's reason,
 * "waiting" (a member's own proposal) in lavender, "late" (an extension that counted as late)
 * in yellow.
 */
export function TaskBanner({
  s,
  tone,
  title,
  body,
}: {
  s: number;
  tone: "declined" | "waiting" | "late";
  title: string;
  body: string;
}): JSX.Element {
  const declined = tone === "declined";
  const ink = declined ? colors.white : colors.ink;
  const fill = declined ? colors.lateCard : tone === "late" ? colors.yellow : colors.lavender;
  return (
    <View
      accessible
      accessibilityRole={declined ? "alert" : undefined}
      accessibilityLabel={`${title}. ${body}`}
      style={{
        flexDirection: "row",
        gap: 12,
        borderRadius: 24 * s,
        backgroundColor: fill,
        padding: 16 * s,
      }}
    >
      <Sym symbol={declined ? taskSymbols.decline : taskSymbols.info} size={20 * s} color={ink} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontFamily: fonts.extraBold, fontSize: 15, color: ink }}>{title}</Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: ink }}>
          {body}
        </Text>
      </View>
    </View>
  );
}
