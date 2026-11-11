import { useMutation } from "convex/react";
import { Typography } from "heroui-native";
import { useState, type JSX } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { endOfDayGmt, shortDay, toDateOnly } from "@convex/lib/dates";
import { isLateExtension } from "@convex/lib/lateRule";
import type { ExtensionType } from "@convex/lib/validators";

import { DateField } from "@/components/planning/date-field";
import { useToast } from "@/components/ui/toast";
import { SaveSheet, WarningNote } from "@/components/ui/save-sheet";
import { SheetScrollView } from "@/components/ui/sheet";
import { fonts, usePageColors } from "@/components/ui/theme";
import { hoursLabel } from "@/components/team-rules/rules";
import { useNow } from "@/lib/use-now";

const TYPES: { value: ExtensionType; title: string; line: string }[] = [
  {
    value: "scope_change",
    title: "Scope change",
    line: "The work grew, as agreed in a meeting.",
  },
  {
    value: "other",
    title: "Other",
    line: "Anything else: illness, a slip, waiting on someone.",
  },
];

/**
 * The owner asking for a later deadline: the new date, the type and why. It says up front
 * whether approving it would count the task as late (convex/lib/lateRule.ts) and whether the
 * date is past the feature's deadline (approving moves the feature too). Admins decide, or the
 * admin task reviewer when an admin owns the task.
 */
export function ExtensionSheet({
  taskId,
  deadline,
  featureDeadline,
  windowHours,
  decidedBy,
  alreadyLate,
  onClose,
}: {
  taskId: Id<"tasks">;
  /** The task's current deadline. */
  deadline: number;
  featureDeadline: number;
  /** Team rules' late window, in hours. */
  windowHours: number;
  /** Who decides, as a sentence: "An admin decides." */
  decidedBy: string;
  /** The task already counts as late (that never goes back). */
  alreadyLate: boolean;
  onClose: () => void;
}): JSX.Element {
  const c = usePageColors();
  const now = useNow();
  const request = useMutation(api.extensions.request);
  const toast = useToast();
  const [date, setDate] = useState("");
  const [type, setType] = useState<ExtensionType>("scope_change");
  const [reason, setReason] = useState("");

  // The day after the current deadline, or today if that's already gone.
  const earliest = toDateOnly(Math.max(deadline + 1, now));
  const picked = date === "" ? null : endOfDayGmt(date);
  const late = isLateExtension({ type, requestedAt: now, currentDeadline: deadline, windowHours });
  const pastFeature = picked !== null && picked > featureDeadline;

  return (
    <SaveSheet
      title="Ask for more time"
      note={`Due ${shortDay(deadline, now)} now. ${decidedBy} The original date stays on record.`}
      isChanged={date !== "" || reason.trim() !== ""}
      problem={
        date === "" ? "Pick the new date." : reason.trim() === "" ? "Say why you need it." : null
      }
      saveLabel="Send request"
      onSave={async () => {
        await request({ taskId, newDeadline: date, type, reason });
        toast("Request sent");
      }}
      onClose={onClose}
      footer={
        <View style={{ gap: 8 }}>
          {alreadyLate ? (
            <Text
              style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: c.muted }}
            >
              The task already counts as late; another extension doesn&apos;t change that.
            </Text>
          ) : late ? (
            <WarningNote
              text={
                type === "other"
                  ? "If it's approved, the task counts as late: only a scope change keeps it on time."
                  : `If it's approved, the task counts as late: it's less than ${hoursLabel(windowHours)} to the deadline.`
              }
            />
          ) : (
            <Text
              style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: c.muted }}
            >
              A scope change asked for this early keeps the task on time.
            </Text>
          )}
          {pastFeature ? (
            <WarningNote
              text={`That's after the feature's deadline (${shortDay(featureDeadline, now)}). If it's approved, the feature moves too.`}
            />
          ) : null}
        </View>
      }
    >
      <SheetScrollView contentContainerStyle={{ gap: 18, paddingHorizontal: 20, paddingTop: 16 }}>
        <DateField
          label="New deadline"
          value={date}
          onChange={setDate}
          minimumDate={earliest}
          inline
        />

        <View accessibilityRole="radiogroup" accessibilityLabel="Why it moves" style={{ gap: 8 }}>
          <Typography type="body-sm" weight="medium">
            Why it moves
          </Typography>
          {TYPES.map((option) => {
            const isChosen = option.value === type;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: isChosen }}
                aria-checked={isChosen}
                accessibilityLabel={`${option.title}. ${option.line}`}
                onPress={() => setType(option.value)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  borderRadius: 18,
                  borderWidth: isChosen ? 2 : 1,
                  borderColor: isChosen ? c.accent : c.hairline,
                  backgroundColor: c.panelRaised,
                  padding: 14,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 999,
                    borderWidth: isChosen ? 6 : 1.5,
                    borderColor: isChosen ? c.accent : c.muted,
                  }}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: c.text }}>
                    {option.title}
                  </Text>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: c.muted }}>
                    {option.line}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={{ gap: 6 }}>
          <Typography type="body-sm" weight="medium">
            Why you need it
          </Typography>
          <TextInput
            accessibilityLabel="Why you need it"
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. Two more screens were agreed in Monday's sync"
            placeholderTextColor={c.placeholder}
            selectionColor={c.text}
            cursorColor={c.text}
            multiline
            maxLength={1000}
            textAlignVertical="top"
            className="min-h-20 rounded-2xl border border-border bg-field px-4 py-3 text-base text-field-foreground focus:border-foreground"
          />
        </View>
      </SheetScrollView>
    </SaveSheet>
  );
}
