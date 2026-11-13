import { useRouter } from "expo-router";
import { useState, type JSX } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { dayName, markFor, spokenDay, useToday, weekDates } from "@/components/logs/log-days";
import {
  entriesOf,
  historyWindow,
  summaryLine,
  useHistoryWindow,
  type HistoryEntry,
} from "@/components/logs/use-history";
import { Avatar, pastelFor } from "@/components/people/avatar";
import { colors, fonts, usePageColors } from "@/components/ui/theme";
import { useSignedInUser } from "@/lib/use-current-user";

import { ActionButton, Breadcrumb, WebPage } from "../page";
import { webType } from "../web-theme";

import { WebLogContent, WebMarkPill, WebWeekPills } from "./log-parts";

/**
 * One person's logs on the website layout: their pastel as a hero (name, title, how the last four
 * weeks went, and their week), then every log and missed weekday, newest first, as a timeline,
 * four weeks at a time.
 */
export function WebPersonLogs({ userId }: { userId: string }): JSX.Element {
  const me = useSignedInUser();
  const router = useRouter();
  const c = usePageColors();
  const { now, today } = useToday();
  const [windows, setWindows] = useState(1);
  const first = useHistoryWindow(userId, today, 0);
  const toLogs = () => router.navigate("/logs");

  if (first === undefined) {
    return (
      <WebPage>
        <Breadcrumb trail={[{ label: "Logs", onPress: toLogs }]} current="Person" />
        <ActivityIndicator color={c.text} style={{ paddingVertical: 120 }} />
      </WebPage>
    );
  }
  if (first === null) {
    return (
      <WebPage>
        <Breadcrumb trail={[{ label: "Logs", onPress: toLogs }]} current="Not found" />
        <View style={{ paddingVertical: 80, alignItems: "flex-start", gap: 16 }}>
          <Text style={{ fontFamily: fonts.black, fontSize: 32, color: c.text }}>
            This person doesn&apos;t exist.
          </Text>
          <ActionButton label="Back to Logs" icon="arrow-back" onPress={toLogs} />
        </View>
      </WebPage>
    );
  }

  const isMe = first.user._id === me._id;
  const week = weekDates(today);
  const byDate = new Map(entriesOf(first).map((e) => [e.date, e]));
  const marks = week.map((date) => markFor(date, today, byDate.get(date)));
  const more = historyWindow(today, windows - 1).from > first.joined;
  const openTask = (taskId: string) =>
    router.push({ pathname: "/tasks/[taskId]", params: { taskId } });

  return (
    <WebPage>
      <Breadcrumb
        trail={[{ label: "Logs", onPress: toLogs }]}
        current={isMe ? "Your logs" : first.user.name}
      />

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 28,
          borderRadius: 28,
          borderWidth: 1.5,
          borderColor: colors.ink,
          backgroundColor: pastelFor(first.user._id),
          padding: 28,
        }}
      >
        <View
          style={{
            flexGrow: 1,
            flexBasis: 420,
            minWidth: 0,
            flexDirection: "row",
            gap: 20,
            alignItems: "center",
          }}
        >
          <Avatar
            size={76}
            fill={colors.tagFill}
            name={first.user.name}
            dim={!first.user.isActive}
          />
          <View style={{ flex: 1, gap: 6 }}>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: fonts.black,
                fontSize: 40,
                lineHeight: 46,
                letterSpacing: -1.2,
                color: colors.ink,
              }}
            >
              {isMe ? "Your logs" : first.user.name}
            </Text>
            <Text style={{ ...webType.body, fontSize: 15, color: colors.ink }}>
              {isMe ? summaryLine(first) : `${first.user.title} · ${summaryLine(first)}`}
            </Text>
          </View>
        </View>
        <View
          style={{
            flexBasis: 360,
            flexGrow: 0,
            gap: 12,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: colors.ink,
            backgroundColor: colors.tagFill,
            padding: 20,
          }}
        >
          <Text style={{ fontFamily: fonts.extraBold, fontSize: 16, color: colors.ink }}>
            This week
          </Text>
          <WebWeekPills week={week} today={today} marks={marks} />
        </View>
      </View>

      <View
        style={{
          borderRadius: 22,
          borderWidth: 1,
          borderColor: c.hairline,
          backgroundColor: c.panel,
          paddingHorizontal: 24,
          paddingVertical: 8,
        }}
      >
        <Timeline entries={entriesOf(first)} today={today} now={now} onOpenTask={openTask} />
        {Array.from({ length: windows - 1 }, (_, i) => (
          <OlderWindow
            key={i + 1}
            userId={userId}
            index={i + 1}
            today={today}
            now={now}
            onOpenTask={openTask}
          />
        ))}
        <View style={{ paddingVertical: 18, alignItems: "flex-start" }}>
          {more ? (
            <ActionButton
              label="Show earlier"
              icon="time-outline"
              variant="secondary"
              onPress={() => setWindows((n) => n + 1)}
            />
          ) : (
            <Text style={{ ...webType.small, color: c.muted }}>
              {isMe ? "You" : first.user.name.split(" ")[0]} joined Cadence on{" "}
              {spokenDay(first.joined)}.
            </Text>
          )}
        </View>
      </View>
    </WebPage>
  );
}

function OlderWindow({
  userId,
  index,
  today,
  now,
  onOpenTask,
}: {
  userId: string;
  index: number;
  today: string;
  now: number;
  onOpenTask: (taskId: string) => void;
}): JSX.Element {
  const range = useHistoryWindow(userId, today, index);
  const c = usePageColors();
  if (range === undefined)
    return <ActivityIndicator color={c.text} style={{ paddingVertical: 24 }} />;
  if (range === null) return <View />;
  return <Timeline entries={entriesOf(range)} today={today} now={now} onOpenTask={onOpenTask} />;
}

/** Each day with a log or a missed weekday: the date on the left, the log on the right. */
function Timeline({
  entries,
  today,
  now,
  onOpenTask,
}: {
  entries: HistoryEntry[];
  today: string;
  now: number;
  onOpenTask: (taskId: string) => void;
}): JSX.Element {
  const c = usePageColors();
  if (entries.length === 0) {
    return (
      <Text style={{ ...webType.body, color: c.muted, paddingVertical: 18 }}>
        Nothing logged in these four weeks.
      </Text>
    );
  }
  return (
    <View>
      {entries.map((entry) => (
        <View
          key={entry.date}
          style={{
            flexDirection: "row",
            gap: 24,
            paddingVertical: 18,
            borderBottomWidth: 1,
            borderBottomColor: c.hairline,
          }}
        >
          <View style={{ width: 150, gap: 6 }}>
            <Text
              accessibilityRole="header"
              accessibilityLabel={spokenDay(entry.date)}
              style={{ ...webType.heading, color: c.text }}
            >
              {dayName(entry.date, today, now)}
            </Text>
            <WebMarkPill mark={markFor(entry.date, today, entry)} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            {entry.log ? (
              <WebLogContent log={entry.log} ink={c.text} muted={c.muted} onOpenTask={onOpenTask} />
            ) : (
              <Text style={{ ...webType.body, color: c.muted }}>No log that weekday.</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}
