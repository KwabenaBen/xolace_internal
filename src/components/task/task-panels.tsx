import type { JSX, ReactNode } from "react";
import { Text, View } from "react-native";

import { fonts } from "@/components/board/board-theme";
import { Sym } from "@/components/board/sym";

import { taskSymbols } from "./task-symbols";
import { taskColors } from "./task-theme";

/** A dark rounded panel with a white heading, like the Board's stats tile. */
function Panel({
  s,
  title,
  aside,
  children,
}: {
  s: number;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <View
      style={{
        borderRadius: 26 * s,
        backgroundColor: taskColors.panel,
        borderWidth: 1,
        borderColor: taskColors.hairline,
        padding: 18 * s,
        gap: 14 * s,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text
          accessibilityRole="header"
          allowFontScaling={false}
          style={{
            flex: 1,
            fontFamily: fonts.extraBold,
            fontSize: 17 * s,
            color: taskColors.white,
          }}
        >
          {title}
        </Text>
        {aside}
      </View>
      {children}
    </View>
  );
}

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
  const dot = 24 * s;
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
              backgroundColor: taskColors.lavender,
              paddingHorizontal: 8 * s,
              paddingVertical: 3 * s,
              alignItems: "center",
            }}
          >
            <Text
              allowFontScaling={false}
              style={{ fontFamily: fonts.extraBold, fontSize: 12 * s, color: taskColors.ink }}
            >
              {criteria.length}
            </Text>
          </View>
        ) : null
      }
    >
      {criteria.length === 0 ? (
        <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: taskColors.secondary }}>
          None yet.
        </Text>
      ) : (
        <View style={{ gap: 12 * s }}>
          {criteria.map((criterion, index) => (
            <View
              key={index}
              accessible
              accessibilityLabel={`${index + 1}. ${criterion}${verified ? ", met" : ""}`}
              style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}
            >
              <View
                style={{
                  width: dot,
                  height: dot,
                  borderRadius: 999,
                  borderWidth: verified ? 0 : 1.5,
                  borderColor: "rgba(255,255,255,0.3)",
                  backgroundColor: verified ? taskColors.lavender : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 1,
                }}
              >
                {verified ? (
                  <Sym
                    symbol={taskSymbols.approve}
                    size={13 * s}
                    color={taskColors.ink}
                    weight="bold"
                  />
                ) : (
                  <Text
                    allowFontScaling={false}
                    style={{ fontFamily: fonts.bold, fontSize: 11 * s, color: taskColors.white }}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text
                style={{
                  flex: 1,
                  fontFamily: fonts.medium,
                  fontSize: 15,
                  lineHeight: 21,
                  color: taskColors.white,
                }}
              >
                {criterion}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Panel>
  );
}

export function DescriptionCard({ s, text }: { s: number; text: string }): JSX.Element {
  return (
    <Panel s={s} title="Description">
      <Text
        selectable
        style={{
          fontFamily: fonts.medium,
          fontSize: 15,
          lineHeight: 22,
          color: "rgba(255,255,255,0.85)",
        }}
      >
        {text}
      </Text>
    </Panel>
  );
}

/**
 * A short notice above the countdown: "declined" in the late red with the admin's reason,
 * "waiting" (a member's own proposal) in lavender.
 */
export function TaskBanner({
  s,
  tone,
  title,
  body,
}: {
  s: number;
  tone: "declined" | "waiting";
  title: string;
  body: string;
}): JSX.Element {
  const declined = tone === "declined";
  const ink = declined ? taskColors.white : taskColors.ink;
  return (
    <View
      accessible
      accessibilityRole={declined ? "alert" : undefined}
      accessibilityLabel={`${title}. ${body}`}
      style={{
        flexDirection: "row",
        gap: 12,
        borderRadius: 24 * s,
        backgroundColor: declined ? taskColors.late : taskColors.lavender,
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
