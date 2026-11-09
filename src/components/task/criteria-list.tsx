import type { JSX } from "react";
import { Text, View } from "react-native";

import { Sym } from "@/components/ui/sym";
import { colors, fonts, usePageColors } from "@/components/ui/theme";

import { taskSymbols } from "./task-symbols";

/**
 * A task's acceptance criteria as a numbered checklist, ticked once the task is verified. Used on
 * the task page (`size="large"`) and in the person page's task cards (`size="small"`).
 */
export function CriteriaList({
  criteria,
  verified,
  size,
  s = 1,
}: {
  criteria: string[];
  verified: boolean;
  size: "large" | "small";
  /** The page's scale (reference points × s), for the large size. */
  s?: number;
}): JSX.Element {
  const c = usePageColors();
  const large = size === "large";
  const dot = large ? 24 * s : 18;
  return (
    <View style={{ gap: large ? 12 * s : 8 }}>
      {criteria.map((criterion, index) => (
        <View
          key={index}
          accessible
          accessibilityLabel={`${index + 1}. ${criterion}${verified ? ", met" : ""}`}
          style={{ flexDirection: "row", gap: large ? 12 : 10, alignItems: "flex-start" }}
        >
          <View
            style={{
              width: dot,
              height: dot,
              borderRadius: 999,
              borderWidth: verified ? 0 : 1.5,
              borderColor: c.separator,
              backgroundColor: verified ? colors.lavender : "transparent",
              alignItems: "center",
              justifyContent: "center",
              marginTop: 1,
            }}
          >
            {verified ? (
              <Sym
                symbol={taskSymbols.approve}
                size={large ? 13 * s : 10}
                color={colors.ink}
                weight="bold"
              />
            ) : (
              <Text
                allowFontScaling={false}
                style={{ fontFamily: fonts.bold, fontSize: large ? 11 * s : 9, color: c.text }}
              >
                {index + 1}
              </Text>
            )}
          </View>
          <Text
            style={{
              flex: 1,
              fontFamily: fonts.medium,
              fontSize: large ? 15 : 14,
              lineHeight: large ? 21 : 19,
              color: c.text,
            }}
          >
            {criterion}
          </Text>
        </View>
      ))}
    </View>
  );
}
