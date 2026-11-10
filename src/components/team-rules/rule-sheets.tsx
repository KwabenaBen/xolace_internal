import { useMutation } from "convex/react";
import { Typography } from "heroui-native";
import { useState, type JSX } from "react";
import { Pressable, Text, View } from "react-native";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import { Avatar, pastelFor } from "@/components/people/avatar";
import { SheetScrollView } from "@/components/ui/sheet";
import { Sym, symbols } from "@/components/ui/sym";
import { colors, fonts, usePageColors } from "@/components/ui/theme";
import { ROLE_LABELS } from "@/constants/labels";

import { RuleSheet } from "./rule-sheet";
import {
  clock,
  firstName,
  hoursLabel,
  LATE_WINDOW_HOURS,
  TIME_RULES,
  type Person,
  type Reviewer,
  type TimeKey,
} from "./rules";
import { TimePicker } from "./time-picker";

/** A note with a yellow dot: something about the choice worth knowing before saving. */
export function RuleWarning({ text }: { text: string }): JSX.Element {
  const c = usePageColors();
  return (
    <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
      <View
        style={{
          width: 10,
          height: 10,
          marginTop: 5,
          borderRadius: 999,
          backgroundColor: colors.yellow,
        }}
      />
      <Text
        style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: c.text }}
      >
        {text}
      </Text>
    </View>
  );
}

/** The morning digest's or the daily log reminder's time, on the time wheel. */
export function TimeRuleSheet({
  settingKey,
  value,
  zone,
  onClose,
}: {
  settingKey: TimeKey;
  /** The saved "HH:mm". */
  value: string;
  /** The team's time zone, as zoneLabel shows it. */
  zone: string;
  onClose: () => void;
}): JSX.Element {
  const setRule = useMutation(api.settings.set);
  const [draft, setDraft] = useState(value);
  const { title, note } = TIME_RULES[settingKey];
  return (
    <RuleSheet
      title={title}
      note={note}
      isChanged={draft !== value}
      saveLabel={`Save ${clock(draft)}`}
      onSave={async () => {
        await setRule({ key: settingKey, value: draft });
      }}
      onClose={onClose}
      footer={
        <Typography type="body-xs" color="muted" className="text-center">
          Team time, {zone}. The same for everyone.
        </Typography>
      }
    >
      <TimePicker value={draft} onChange={setDraft} label={`${title} time`} />
    </RuleSheet>
  );
}

/** Who verifies admins' tasks: the active team as a list to pick from. */
export function ReviewerSheet({
  current,
  people,
  myId,
  onClose,
}: {
  current: Reviewer;
  people: readonly Person[];
  myId: Id<"users">;
  onClose: () => void;
}): JSX.Element {
  const c = usePageColors();
  const setRule = useMutation(api.settings.set);
  const currentId = current.kind === "person" ? current.person._id : undefined;
  const [chosenId, setChosenId] = useState(currentId);
  const active = people.filter((p) => p.isActive);
  const chosen = active.find((p) => p._id === chosenId);

  return (
    <RuleSheet
      title="Admin task reviewer"
      note="Verifies the tasks an admin owns, so nobody approves their own work."
      isChanged={chosen !== undefined && chosen._id !== currentId}
      saveLabel={chosen === undefined ? "Save" : `Make ${firstName(chosen.name)} the reviewer`}
      onSave={async () => {
        if (chosen === undefined) return;
        await setRule({
          key: "adminTaskReviewer",
          value: { email: chosen.email, userId: chosen._id },
        });
      }}
      onClose={onClose}
      footer={
        chosen?.role === "admin" ? (
          <RuleWarning
            text={`${firstName(chosen.name)} is an admin too, so they'd verify their own tasks. Someone who isn't an admin keeps every check independent.`}
          />
        ) : undefined
      }
    >
      <SheetScrollView
        accessibilityRole="radiogroup"
        accessibilityLabel="Admin task reviewer"
        contentContainerStyle={{ gap: 4, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 }}
      >
        {active.map((person) => {
          const isChosen = person._id === chosenId;
          const isMe = person._id === myId;
          return (
            <Pressable
              key={person._id}
              accessibilityRole="radio"
              accessibilityState={{ checked: isChosen }}
              accessibilityLabel={`${person.name}${isMe ? " (you)" : ""}, ${person.title}, ${ROLE_LABELS[person.role]}`}
              onPress={() => setChosenId(person._id)}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                borderRadius: 18,
                paddingVertical: 8,
                paddingHorizontal: 8,
                backgroundColor: isChosen ? c.panelRaised : "transparent",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Avatar
                size={44}
                fill={pastelFor(person._id)}
                name={person.name}
                isAdmin={person.role === "admin"}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: fonts.semibold, fontSize: 15, color: c.text }}
                >
                  {person.name}
                  {isMe ? <Text style={{ color: c.muted }}> (you)</Text> : null}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: fonts.medium, fontSize: 13, color: c.muted }}
                >
                  {person.title}
                </Text>
              </View>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  borderWidth: isChosen ? 0 : 1.5,
                  borderColor: c.hairline,
                  backgroundColor: isChosen ? c.accent : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isChosen ? (
                  <Sym symbol={symbols.check} size={14} color={c.accentText} weight="bold" />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </SheetScrollView>
    </RuleSheet>
  );
}

/** How close to a deadline an extension request has to be to count as late. */
export function LateWindowSheet({
  value,
  onClose,
}: {
  /** The saved number of hours. */
  value: number;
  onClose: () => void;
}): JSX.Element {
  const c = usePageColors();
  const setRule = useMutation(api.settings.set);
  const [draft, setDraft] = useState(value);
  // A value set some other way (e.g. 36) stays on the list, so it shows as chosen.
  const choices = (LATE_WINDOW_HOURS as readonly number[]).includes(value)
    ? [...LATE_WINDOW_HOURS]
    : [...LATE_WINDOW_HOURS, value].sort((a, b) => a - b);

  return (
    <RuleSheet
      title="Late extension window"
      note="An extension asked for close to its deadline still counts as late, even once approved, and so does one that isn't a scope change."
      isChanged={draft !== value}
      saveLabel={`Save ${hoursLabel(draft)}`}
      onSave={async () => {
        await setRule({ key: "extensionLateWindowHours", value: draft });
      }}
      onClose={onClose}
      footer={
        <Typography type="body-sm" color="muted">
          {`Asked for less than ${hoursLabel(draft)} before the deadline, or not a scope change: late.`}
        </Typography>
      }
    >
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Late extension window"
        style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 20, paddingBottom: 8 }}
      >
        {choices.map((hours) => {
          const isChosen = hours === draft;
          return (
            <Pressable
              key={hours}
              accessibilityRole="radio"
              accessibilityState={{ checked: isChosen }}
              accessibilityLabel={hoursLabel(hours)}
              onPress={() => setDraft(hours)}
              style={({ pressed }) => ({
                minWidth: 64,
                minHeight: 44,
                paddingHorizontal: 16,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: isChosen ? c.accent : c.hairline,
                backgroundColor: isChosen ? c.accent : c.panelRaised,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: fonts.bold,
                  fontSize: 15,
                  color: isChosen ? c.accentText : c.text,
                }}
              >
                {hours} h
              </Text>
            </Pressable>
          );
        })}
      </View>
    </RuleSheet>
  );
}
