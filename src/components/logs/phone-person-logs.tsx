import { useRouter } from "expo-router";
import { useState, type JSX } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import {
  DetailPage,
  PageLoading,
  PageNotFound,
  useGoBack,
  usePageSize,
} from "@/components/ui/detail-page";
import { PageHeader } from "@/components/ui/page-header";
import { PillButton } from "@/components/ui/pill-button";
import { fonts, usePageColors } from "@/components/ui/theme";
import { useSignedInUser } from "@/lib/use-current-user";

import { dayName, markFor, plainDay, useToday, weekDates } from "./log-days";
import { LogBody, MarkPill, WeekPills } from "./phone-parts";
import {
  entriesOf,
  historyWindow,
  summaryLine,
  useHistoryWindow,
  type HistoryEntry,
} from "./use-history";

/**
 * One person's logs on the phone (from the team's rows on the Logs tab, or their card on People):
 * their week as pills, how the last four weeks went, then every log and missed weekday, newest
 * first, four weeks at a time.
 */
export function PhonePersonLogs({ userId }: { userId: string }): JSX.Element {
  const me = useSignedInUser();
  const router = useRouter();
  const goBack = useGoBack();
  const c = usePageColors();
  const { s, content } = usePageSize();
  const { now, today } = useToday();
  const [windows, setWindows] = useState(1);
  const first = useHistoryWindow(userId, today, 0);

  if (first === undefined) {
    return (
      <DetailPage title="Logs" content={content}>
        <PageLoading />
      </DetailPage>
    );
  }
  if (first === null) {
    return (
      <DetailPage title="Logs" content={content}>
        <PageNotFound s={s} message="This person doesn't exist." onBack={goBack} />
      </DetailPage>
    );
  }

  const isMe = first.user._id === me._id;
  const week = weekDates(today);
  const byDate = new Map(entriesOf(first).map((e) => [e.date, e]));
  const marks = week.map((date) => markFor(date, today, byDate.get(date)));
  const oldest = historyWindow(today, windows - 1).from;
  const more = oldest > first.joined;
  const openTask = (taskId: string) =>
    router.push({ pathname: "/tasks/[taskId]", params: { taskId } });

  return (
    <DetailPage title={`${first.user.name}'s logs`} content={content}>
      <View style={{ gap: 22 * s }}>
        <PageHeader
          s={s}
          title={isMe ? "Your logs" : first.user.name}
          subtitle={isMe ? summaryLine(first) : `${first.user.title} · ${summaryLine(first)}`}
          onBack={goBack}
        />
        <WeekPills s={s} width={content} week={week} today={today} marks={marks} />
        <Entries entries={entriesOf(first)} s={s} today={today} now={now} onOpenTask={openTask} />
        {Array.from({ length: windows - 1 }, (_, i) => (
          <OlderWindow
            key={i + 1}
            userId={userId}
            index={i + 1}
            s={s}
            today={today}
            now={now}
            onOpenTask={openTask}
          />
        ))}
        {more ? (
          <PillButton
            label="Show earlier"
            variant="secondary"
            onPress={() => setWindows((n) => n + 1)}
          />
        ) : (
          <Text
            style={{ fontFamily: fonts.medium, fontSize: 13, color: c.muted, textAlign: "center" }}
          >
            {isMe ? "You" : first.user.name.split(" ")[0]} joined Cadence on{" "}
            {plainDay(first.joined, now)}.
          </Text>
        )}
      </View>
    </DetailPage>
  );
}

/** A window further back, loaded when "Show earlier" asks for it. */
function OlderWindow({
  userId,
  index,
  s,
  today,
  now,
  onOpenTask,
}: {
  userId: string;
  index: number;
  s: number;
  today: string;
  now: number;
  onOpenTask: (taskId: string) => void;
}): JSX.Element {
  const range = useHistoryWindow(userId, today, index);
  const c = usePageColors();
  if (range === undefined) return <ActivityIndicator color={c.text} />;
  if (range === null) return <View />;
  return (
    <Entries entries={entriesOf(range)} s={s} today={today} now={now} onOpenTask={onOpenTask} />
  );
}

/** Days with a log or a missed weekday, each under its date. */
function Entries({
  entries,
  s,
  today,
  now,
  onOpenTask,
}: {
  entries: HistoryEntry[];
  s: number;
  today: string;
  now: number;
  onOpenTask: (taskId: string) => void;
}): JSX.Element {
  const c = usePageColors();
  if (entries.length === 0) {
    return (
      <Text
        style={{ fontFamily: fonts.medium, fontSize: 15, color: c.muted, paddingHorizontal: 4 }}
      >
        Nothing logged in these four weeks.
      </Text>
    );
  }
  return (
    <View style={{ gap: 14 * s }}>
      {entries.map((entry) => (
        <View key={entry.date} style={{ gap: 8 * s }}>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 }}
          >
            <Text
              accessibilityRole="header"
              maxFontSizeMultiplier={1.3}
              style={{ flex: 1, fontFamily: fonts.extraBold, fontSize: 16 * s, color: c.text }}
            >
              {dayName(entry.date, today, now)}
            </Text>
            <MarkPill mark={markFor(entry.date, today, entry)} s={s} />
          </View>
          {entry.log ? (
            <View
              style={{
                borderRadius: 22 * s,
                borderWidth: 1,
                borderColor: c.hairline,
                backgroundColor: c.panel,
                padding: 16 * s,
              }}
            >
              <LogBody log={entry.log} s={s} ink={c.text} muted={c.muted} onOpenTask={onOpenTask} />
            </View>
          ) : (
            <Text
              style={{
                fontFamily: fonts.medium,
                fontSize: 14 * s,
                color: c.muted,
                paddingHorizontal: 4,
              }}
            >
              No log that weekday.
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}
