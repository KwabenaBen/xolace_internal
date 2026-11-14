import { useQuery } from "convex/react";
import { useIsFocused, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState, type JSX } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@convex/_generated/api";
import { addDays, isWeekendDate } from "@convex/lib/dates";

import { PillButton } from "@/components/ui/pill-button";
import { usePageSize } from "@/components/ui/detail-page";
import { Sym, symbols, type SymbolSpec } from "@/components/ui/sym";
import { colors, fonts, usePageColors } from "@/components/ui/theme";
import { useSignedInUser } from "@/lib/use-current-user";

import {
  dayName,
  markFor,
  spokenDay,
  useTeamWeek,
  useToday,
  weekDates,
  weekRange,
  type TeamDay,
} from "./log-days";
import { LogBody, PersonDayRow, WeekPills } from "./phone-parts";

/**
 * The phone's Logs tab, on the theme's page like the Board: your week as seven pills (logged,
 * missed, today), today's log on a lavender card (or a prompt to write it, and a line at the
 * weekend), then the team on one day (today, or a day picked in the week or stepped back to),
 * each with how their day went. Tap someone for all their logs.
 */
export function PhoneLogs(): JSX.Element {
  const user = useSignedInUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const c = usePageColors();
  const { s, content } = usePageSize();
  const { now, today } = useToday();
  const week = weekDates(today);
  const teamWeek = useTeamWeek(today);
  // The team section's day: today unless another was picked.
  const [picked, setPicked] = useState<string | null>(null);
  const teamDate = picked ?? today;
  const inWeek = week.indexOf(teamDate);
  const otherDay = useQuery(api.dailyLogs.day, inWeek === -1 ? { date: teamDate } : "skip");
  const teamDay: TeamDay | undefined = inWeek === -1 ? otherDay : teamWeek[inWeek];
  const todayData = teamWeek[week.indexOf(today)];
  const mine = todayData?.people.find((p) => p.user._id === user._id);

  const myMarks = week.map((date, i) =>
    markFor(
      date,
      today,
      teamWeek[i]?.people.find((p) => p.user._id === user._id)
    )
  );
  const openPerson = (userId: string) =>
    router.push({ pathname: "/logs/[userId]", params: { userId } });
  const openTask = (taskId: string) =>
    router.push({ pathname: "/tasks/[taskId]", params: { taskId } });
  const write = () => router.push("/logs/write");

  return (
    <View style={{ flex: 1, backgroundColor: c.page }}>
      {isFocused ? <StatusBar style={c.statusBar} /> : null}
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: 32,
          alignItems: "center",
        }}
      >
        <View style={{ width: content, gap: 22 * s }}>
          <View style={{ paddingHorizontal: 4 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: c.muted }}>
              {spokenDay(today).replace(/ \d{4}$/, "")}
            </Text>
            <Text
              accessibilityRole="header"
              style={{ fontFamily: fonts.black, fontSize: 34, letterSpacing: -1, color: c.text }}
            >
              logs
            </Text>
          </View>

          <View style={{ gap: 12 * s }}>
            <View style={{ flexDirection: "row", alignItems: "baseline", paddingHorizontal: 4 }}>
              <Text
                accessibilityRole="header"
                maxFontSizeMultiplier={1.3}
                style={{ flex: 1, fontFamily: fonts.extraBold, fontSize: 18 * s, color: c.text }}
              >
                Your week
              </Text>
              <Text
                maxFontSizeMultiplier={1.3}
                style={{ fontFamily: fonts.semibold, fontSize: 13 * s, color: c.muted }}
              >
                {weekRange(week)}
              </Text>
            </View>
            <WeekPills
              s={s}
              width={content}
              week={week}
              today={today}
              marks={myMarks}
              picked={picked ?? undefined}
              onPick={(date) => setPicked(date === today ? null : date)}
            />
          </View>

          <TodayCard
            s={s}
            today={today}
            loading={todayData === undefined}
            log={mine?.log ?? null}
            onWrite={write}
            onOpenTask={openTask}
          />

          <View style={{ gap: 12 * s }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 }}
            >
              <Text
                accessibilityRole="header"
                style={{
                  flex: 1,
                  fontFamily: fonts.black,
                  fontSize: 28,
                  letterSpacing: -0.8,
                  color: c.text,
                }}
              >
                the team
              </Text>
              <DayStepper
                s={s}
                label={dayName(teamDate, today, now)}
                // Stops once a day had nobody on Cadence yet: nothing further back to see.
                onBack={
                  teamDay !== undefined && teamDay.people.length === 0
                    ? undefined
                    : () => setPicked(addDays(teamDate, -1))
                }
                onForward={
                  teamDate < today
                    ? () => {
                        const next = addDays(teamDate, 1);
                        setPicked(next === today ? null : next);
                      }
                    : undefined
                }
                spoken={spokenDay(teamDate)}
              />
            </View>
            {teamDay === undefined ? (
              <ActivityIndicator color={c.text} style={{ paddingVertical: 40 }} />
            ) : teamDay.people.length === 0 ? (
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 15,
                  color: c.muted,
                  paddingHorizontal: 4,
                }}
              >
                Nobody was on Cadence yet that day.
              </Text>
            ) : (
              [...teamDay.people]
                // You first, then everyone by name (the server's order).
                .sort((a, b) => Number(b.user._id === user._id) - Number(a.user._id === user._id))
                .map((person) => (
                  <PersonDayRow
                    key={person.user._id}
                    person={person}
                    mark={markFor(teamDate, today, person)}
                    isYou={person.user._id === user._id}
                    s={s}
                    onPress={() => openPerson(person.user._id)}
                  />
                ))
            )}
            {teamDay !== undefined && isWeekendDate(teamDate) ? (
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 13,
                  color: c.muted,
                  paddingHorizontal: 4,
                }}
              >
                Weekends are optional: a line if you like, never counted as missed.
              </Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/** Quieter ink on the lavender card, still 4.5:1 or better. */
const ON_LAVENDER_MUTED = "rgba(17,17,17,0.78)";

/**
 * Today on a lavender sticker: your log with an Edit button, or a prompt to write it. It locks at
 * midnight GMT, which it says.
 */
function TodayCard({
  s,
  today,
  loading,
  log,
  onWrite,
  onOpenTask,
}: {
  s: number;
  today: string;
  loading: boolean;
  log: TeamDay["people"][number]["log"];
  onWrite: () => void;
  onOpenTask: (taskId: string) => void;
}): JSX.Element {
  const weekend = isWeekendDate(today);
  return (
    <View
      style={{
        borderRadius: 30 * s,
        borderWidth: 1.5,
        borderColor: colors.ink,
        backgroundColor: colors.lavender,
        padding: 20 * s,
        gap: 16 * s,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 * s }}>
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            fontFamily: fonts.black,
            fontSize: 26 * s,
            letterSpacing: -0.8,
            color: colors.ink,
          }}
        >
          {weekend ? "the weekend" : "today"}
        </Text>
        <View
          style={{
            borderRadius: 999,
            paddingHorizontal: 10 * s,
            paddingVertical: 4 * s,
            backgroundColor: colors.tagFill,
            borderWidth: 1,
            borderColor: colors.ink,
          }}
        >
          <Text
            maxFontSizeMultiplier={1.3}
            style={{ fontFamily: fonts.bold, fontSize: 11 * s, color: colors.ink }}
          >
            {log ? "Logged" : weekend ? "Optional" : "Not yet"}
          </Text>
        </View>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.ink} />
      ) : log ? (
        <LogBody
          log={log}
          s={s}
          ink={colors.ink}
          muted={ON_LAVENDER_MUTED}
          onOpenTask={onOpenTask}
        />
      ) : (
        <Text
          style={{
            fontFamily: fonts.medium,
            fontSize: 15 * s,
            lineHeight: 21 * s,
            color: colors.ink,
          }}
        >
          {weekend
            ? "No log needed at the weekend. Add a line if you did something worth noting."
            : "What did you get done today, what's next, and is anything in your way?"}
        </Text>
      )}
      <View style={{ gap: 8 * s }}>
        <PillButton
          label={log ? "Edit" : weekend ? "Add a line" : "Write today's log"}
          onPress={onWrite}
          isDisabled={loading}
        />
        <Text
          maxFontSizeMultiplier={1.3}
          style={{
            fontFamily: fonts.medium,
            fontSize: 12 * s,
            textAlign: "center",
            color: ON_LAVENDER_MUTED,
          }}
        >
          {log
            ? "You can change it until midnight (GMT); then it's locked."
            : "Locks at midnight (GMT)."}
        </Text>
      </View>
    </View>
  );
}

/** "‹ Yesterday ›": steps the team's day back, and forward up to today. */
function DayStepper({
  s,
  label,
  spoken,
  onBack,
  onForward,
}: {
  s: number;
  label: string;
  spoken: string;
  onBack?: () => void;
  onForward?: () => void;
}): JSX.Element {
  const c = usePageColors();
  const arrow = (symbol: SymbolSpec, what: string, onPress?: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={what}
      accessibilityState={{ disabled: onPress === undefined }}
      disabled={onPress === undefined}
      hitSlop={8}
      onPress={onPress}
      className="active:opacity-60"
      style={{
        width: 34 * s,
        height: 34 * s,
        borderRadius: 999,
        backgroundColor: c.panel,
        borderWidth: 1,
        borderColor: c.hairline,
        alignItems: "center",
        justifyContent: "center",
        opacity: onPress === undefined ? 0.35 : 1,
      }}
    >
      <Sym symbol={symbol} size={14 * s} color={c.text} weight="semibold" />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 * s }}>
      {arrow(symbols.back, "The day before", onBack)}
      <Text
        accessibilityLabel={spoken}
        maxFontSizeMultiplier={1.3}
        style={{
          minWidth: 76 * s,
          textAlign: "center",
          fontFamily: fonts.bold,
          fontSize: 13 * s,
          color: c.text,
        }}
      >
        {label}
      </Text>
      {arrow(symbols.forward, "The day after", onForward)}
    </View>
  );
}
