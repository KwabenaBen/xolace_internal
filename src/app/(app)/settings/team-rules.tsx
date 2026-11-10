import { useQuery } from "convex/react";
import { useState, type JSX } from "react";
import { Pressable, Text, View } from "react-native";

import { api } from "@convex/_generated/api";

import { Avatar, pastelFor } from "@/components/people/avatar";
import { RuleRow } from "@/components/team-rules/rule-row";
import {
  LateWindowSheet,
  ReviewerSheet,
  RuleWarning,
  TimeRuleSheet,
} from "@/components/team-rules/rule-sheets";
import {
  clock,
  firstName,
  hoursLabel,
  reviewerOf,
  ruleValue,
  TIME_RULES,
  timeValue,
  zoneLabel,
  type Reviewer,
  type TimeKey,
} from "@/components/team-rules/rules";
import { DetailPage, PageLoading, useGoBack, usePageSize } from "@/components/ui/detail-page";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { Sym, symbols } from "@/components/ui/sym";
import { fonts, usePageColors } from "@/components/ui/theme";
import { useSignedInUser } from "@/lib/use-current-user";

type Editing = TimeKey | "reviewer" | "lateWindow" | null;

/** What's worth knowing about the reviewer as it stands (nothing when all is well). */
function reviewerWarning(reviewer: Reviewer): string | undefined {
  switch (reviewer.kind) {
    case "none":
      return "Nobody is chosen yet, so nobody can verify the tasks an admin owns.";
    case "invited":
      return `${reviewer.email} hasn't joined yet. They take this on once they sign up.`;
    case "person": {
      const first = firstName(reviewer.person.name);
      if (!reviewer.person.isActive) {
        return `${first} has been deactivated, so someone else needs to take this on.`;
      }
      if (reviewer.person.role === "admin") {
        return `${first} is an admin too, so they'd verify their own tasks.`;
      }
      return undefined;
    }
  }
}

/**
 * Settings → Team rules: the rules Cadence runs on, the same for everyone. Everyone can read
 * them; admins tap one to change it in a sheet (the server checks that too, convex/settings.ts).
 * The time zone is shown, not changed: every date in Cadence is counted in GMT.
 */
export default function TeamRulesScreen(): JSX.Element {
  const me = useSignedInUser();
  const isAdmin = me.role === "admin";
  const goBack = useGoBack();
  const { s, content } = usePageSize();
  const c = usePageColors();
  const rules = useQuery(api.settings.list);
  const people = useQuery(api.users.list);
  const [editing, setEditing] = useState<Editing>(null);

  const header = (
    <PageHeader
      s={s}
      title="Team rules"
      subtitle={
        isAdmin
          ? "The same for everyone. Tap one to change it."
          : "The same for everyone. Only admins can change them."
      }
      onBack={goBack}
    />
  );

  if (rules === undefined || people === undefined) {
    return (
      <DetailPage title="Team rules" content={content}>
        <View style={{ gap: 22 * s }}>
          {header}
          <PageLoading />
        </View>
      </DetailPage>
    );
  }

  const reviewer = reviewerOf(ruleValue(rules, "adminTaskReviewer"), people);
  const warning = reviewerWarning(reviewer);
  const zone = zoneLabel(ruleValue(rules, "timeZone"));
  const lateValue = ruleValue(rules, "extensionLateWindowHours");
  const lateHours = typeof lateValue === "number" ? lateValue : 24;
  const edit = (what: Exclude<Editing, null>) => (isAdmin ? () => setEditing(what) : undefined);
  const muted = { fontFamily: fonts.medium, fontSize: 13 * s, lineHeight: 19 * s, color: c.muted };

  const reviewerName =
    reviewer.kind === "person"
      ? reviewer.person.name
      : reviewer.kind === "invited"
        ? reviewer.email
        : "Not chosen";
  const reviewerLine =
    reviewer.kind === "person"
      ? `${reviewer.person.title}${reviewer.person._id === me._id ? " · you" : ""}`
      : reviewer.kind === "invited"
        ? "Invited"
        : isAdmin
          ? "Tap to choose someone"
          : "An admin chooses who";

  return (
    <DetailPage title="Team rules" content={content}>
      <View style={{ gap: 22 * s }}>
        {header}

        <Panel s={s} title="Admin task reviewer">
          <Pressable
            disabled={!isAdmin}
            onPress={edit("reviewer")}
            accessibilityRole={isAdmin ? "button" : undefined}
            accessibilityLabel={`Admin task reviewer: ${reviewerName}, ${reviewerLine}`}
            accessibilityHint={isAdmin ? "Choose who verifies the tasks an admin owns" : undefined}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 12 * s,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Avatar
              size={52 * s}
              fill={pastelFor(reviewer.kind === "person" ? reviewer.person._id : reviewerName)}
              name={reviewer.kind === "person" ? reviewer.person.name : undefined}
              symbol={
                reviewer.kind === "person"
                  ? undefined
                  : reviewer.kind === "invited"
                    ? symbols.invite
                    : symbols.add
              }
              dim={reviewer.kind === "person" && !reviewer.person.isActive}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                numberOfLines={1}
                maxFontSizeMultiplier={1.4}
                style={{ fontFamily: fonts.extraBold, fontSize: 17 * s, color: c.text }}
              >
                {reviewerName}
              </Text>
              <Text numberOfLines={1} maxFontSizeMultiplier={1.4} style={muted}>
                {reviewerLine}
              </Text>
            </View>
            {isAdmin ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14 * s, color: c.text }}>
                  Change
                </Text>
                <Sym symbol={symbols.forward} size={12 * s} color={c.muted} weight="semibold" />
              </View>
            ) : null}
          </Pressable>
          <Text maxFontSizeMultiplier={1.4} style={muted}>
            Verifies the tasks an admin owns, so nobody approves their own work.
          </Text>
          {warning !== undefined ? <RuleWarning text={warning} /> : null}
        </Panel>

        <Panel s={s} title="Times">
          <View>
            {(["morningDigestTime", "dailyLogReminderTime"] as const).map((key, index) => (
              <RuleRow
                key={key}
                s={s}
                isFirst={index === 0}
                label={TIME_RULES[key].title}
                value={clock(timeValue(rules, key))}
                note={TIME_RULES[key].note}
                onPress={edit(key)}
              />
            ))}
            <RuleRow
              s={s}
              label="Time zone"
              value={zone}
              note="The times above are in this zone. Deadlines and daily logs are counted in GMT."
            />
          </View>
        </Panel>

        <Panel s={s} title="Deadline extensions">
          <RuleRow
            s={s}
            isFirst
            label="Late window"
            value={hoursLabel(lateHours)}
            note={`An approved extension still counts as late if it was asked for less than ${hoursLabel(lateHours)} before the deadline.`}
            onPress={edit("lateWindow")}
          />
        </Panel>

        <Text maxFontSizeMultiplier={1.4} style={{ ...muted, paddingHorizontal: 4 }}>
          {isAdmin
            ? "Changes apply to everyone straight away, and each one is kept in the activity log."
            : "Only admins can change team rules. Ask one if something needs to change."}
        </Text>
      </View>

      {editing === "reviewer" ? (
        <ReviewerSheet
          current={reviewer}
          people={people}
          myId={me._id}
          onClose={() => setEditing(null)}
        />
      ) : editing === "lateWindow" ? (
        <LateWindowSheet value={lateHours} onClose={() => setEditing(null)} />
      ) : editing !== null ? (
        <TimeRuleSheet
          settingKey={editing}
          value={timeValue(rules, editing)}
          zone={zone}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </DetailPage>
  );
}
