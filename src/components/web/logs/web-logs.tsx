import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useRef, useState, type ComponentRef, type JSX, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { api } from "@convex/_generated/api";
import { addDays, isWeekendDate } from "@convex/lib/dates";

import {
  dayName,
  dayParts,
  markFor,
  MARK_WORDS,
  spokenDay,
  useTeamWeek,
  useToday,
  weekDates,
  weekRange,
  type DayPerson,
  type TeamDay,
} from "@/components/logs/log-days";
import { MARK_COLORS } from "@/components/logs/mark-colors";
import { Avatar, pastelFor } from "@/components/people/avatar";
import { colors, fonts, usePageColors } from "@/components/ui/theme";
import { useSignedInUser } from "@/lib/use-current-user";

import { useTweenTo } from "../motion";
import { ActionButton, WebPage } from "../page";
import { useHover } from "../use-hover";
import { webType } from "../web-theme";

import { WebDayStepper, WebLogContent, WebMarkPill, WebWeekPills } from "./log-parts";

/** From this window width the week's grid sits beside the team (as on the Board). */
const SIDE_BY_SIDE = 1400;
const SIDE_WIDTH = 380;
const GAP = 20;
/** Quieter ink on the lavender hero, still 4.5:1 or better. */
const ON_LAVENDER_MUTED = "rgba(17,17,17,0.78)";

/**
 * The Logs page on the website layout, in the Board's style: today's log on a lavender hero
 * beside your week (pick a day to see the team's), then the team on that day, a row each with
 * how their day went and their log, and beside it the whole team's week at a glance. Writing
 * opens the log form as a dialog. The phone keeps its own tab (src/components/logs/).
 */
export function WebLogs(): JSX.Element {
  const user = useSignedInUser();
  const router = useRouter();
  const c = usePageColors();
  const { width } = useWindowDimensions();
  const { now, today } = useToday();
  const week = weekDates(today);
  const teamWeek = useTeamWeek(today);
  const [picked, setPicked] = useState<string | null>(null);
  const teamDate = picked ?? today;
  const inWeek = week.indexOf(teamDate);
  const otherDay = useQuery(api.dailyLogs.day, inWeek === -1 ? { date: teamDate } : "skip");
  const teamDay: TeamDay | undefined = inWeek === -1 ? otherDay : teamWeek[inWeek];
  const todayData = teamWeek[week.indexOf(today)];
  const mine = todayData?.people.find((p) => p.user._id === user._id);
  const weekend = isWeekendDate(today);
  const wide = width >= SIDE_BY_SIDE;

  const myMarks = week.map((date, i) =>
    markFor(
      date,
      today,
      teamWeek[i]?.people.find((p) => p.user._id === user._id)
    )
  );
  const pick = (date: string | null) => setPicked(date === today ? null : date);
  const write = () => router.push("/logs/write");
  const openPerson = (userId: string) =>
    router.push({ pathname: "/logs/[userId]", params: { userId } });
  const openTask = (taskId: string) =>
    router.push({ pathname: "/tasks/[taskId]", params: { taskId } });

  return (
    <WebPage>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <View style={{ gap: 2 }}>
          <Text style={{ ...webType.small, color: c.muted }}>{spokenDay(today)}</Text>
          <Text accessibilityRole="header" style={{ ...webType.title, color: c.text }}>
            Logs
          </Text>
        </View>
        <ActionButton
          label={
            mine?.log ? "Edit today's log" : weekend ? "Add a weekend line" : "Write today's log"
          }
          icon={mine?.log ? "create-outline" : "add"}
          onPress={write}
        />
      </View>

      <Hero
        today={today}
        week={week}
        marks={myMarks}
        picked={picked ?? undefined}
        onPick={pick}
        loading={todayData === undefined}
        log={mine?.log ?? null}
        onWrite={write}
        onOpenTask={openTask}
      />

      <View style={{ flexDirection: wide ? "row" : "column", alignItems: "flex-start", gap: GAP }}>
        <View style={wide ? { flex: 1, minWidth: 0 } : { width: "100%" }}>
          <Card>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                paddingHorizontal: 12,
                paddingBottom: 8,
              }}
            >
              <Text
                accessibilityRole="header"
                style={{
                  fontFamily: fonts.extraBold,
                  fontSize: 20,
                  letterSpacing: -0.4,
                  color: c.text,
                }}
              >
                The team
              </Text>
              <WebDayStepper
                label={dayName(teamDate, today, now)}
                spoken={spokenDay(teamDate)}
                onBack={() => pick(addDays(teamDate, -1))}
                onForward={teamDate < today ? () => pick(addDays(teamDate, 1)) : undefined}
              />
            </View>
            {teamDay === undefined ? (
              <ActivityIndicator color={c.text} style={{ paddingVertical: 48 }} />
            ) : teamDay.people.length === 0 ? (
              <Text style={{ ...webType.body, color: c.muted, padding: 12 }}>
                Nobody was on Cadence yet that day.
              </Text>
            ) : (
              [...teamDay.people]
                .sort((a, b) => Number(b.user._id === user._id) - Number(a.user._id === user._id))
                .map((person) => (
                  <PersonRow
                    key={person.user._id}
                    person={person}
                    mark={markFor(teamDate, today, person)}
                    isYou={person.user._id === user._id}
                    onOpen={() => openPerson(person.user._id)}
                    onOpenTask={openTask}
                  />
                ))
            )}
            {teamDay !== undefined && isWeekendDate(teamDate) ? (
              <Text
                style={{ ...webType.small, color: c.muted, paddingHorizontal: 12, paddingTop: 8 }}
              >
                Weekends are optional: a line if you like, never counted as missed.
              </Text>
            ) : null}
          </Card>
        </View>
        <View style={wide ? { width: SIDE_WIDTH } : { width: "100%" }}>
          <WeekGrid
            week={week}
            today={today}
            teamWeek={teamWeek}
            youId={user._id}
            onOpenPerson={openPerson}
          />
        </View>
      </View>
    </WebPage>
  );
}

/** A plain panel in the theme (as on the feature page). */
function Card({ children }: { children: ReactNode }): JSX.Element {
  const c = usePageColors();
  return (
    <View
      style={{
        borderRadius: 22,
        borderWidth: 1,
        borderColor: c.hairline,
        backgroundColor: c.panel,
        paddingHorizontal: 12,
        paddingVertical: 16,
        gap: 4,
      }}
    >
      {children}
    </View>
  );
}

/**
 * Today on a lavender hero: your log (or what to write), and beside it your week, whose days pick
 * the team's day below. It says when the log locks.
 */
function Hero({
  today,
  week,
  marks,
  picked,
  onPick,
  loading,
  log,
  onWrite,
  onOpenTask,
}: {
  today: string;
  week: string[];
  marks: ReturnType<typeof markFor>[];
  picked?: string;
  onPick: (date: string) => void;
  loading: boolean;
  log: DayPerson["log"];
  onWrite: () => void;
  onOpenTask: (taskId: string) => void;
}): JSX.Element {
  const weekend = isWeekendDate(today);
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 28,
        borderRadius: 28,
        borderWidth: 1.5,
        borderColor: colors.ink,
        backgroundColor: colors.lavender,
        padding: 28,
      }}
    >
      <View style={{ flexGrow: 1, flexBasis: 420, minWidth: 0, gap: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Tag text={log ? "Logged" : weekend ? "Optional" : "Not yet"} />
          <Text style={{ ...webType.small, color: colors.ink }}>
            {log
              ? "You can change it until midnight (GMT); then it's locked."
              : "Locks at midnight (GMT)."}
          </Text>
        </View>
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
          {weekend ? "The weekend" : "Your day"}
        </Text>
        {loading ? (
          <ActivityIndicator color={colors.ink} style={{ alignSelf: "flex-start" }} />
        ) : log ? (
          <WebLogContent
            log={log}
            ink={colors.ink}
            muted={ON_LAVENDER_MUTED}
            onOpenTask={onOpenTask}
          />
        ) : (
          <View style={{ gap: 14, alignItems: "flex-start" }}>
            <Text
              style={{
                ...webType.body,
                fontSize: 15,
                lineHeight: 23,
                color: colors.ink,
                maxWidth: 560,
              }}
            >
              {weekend
                ? "No log needed at the weekend. Add a line if you did something worth noting."
                : "What did you get done today, what's next, and is anything in your way?"}
            </Text>
            <InkButton label={weekend ? "Add a line" : "Write today's log"} onPress={onWrite} />
          </View>
        )}
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
        <View
          style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}
        >
          <Text style={{ fontFamily: fonts.extraBold, fontSize: 16, color: colors.ink }}>
            Your week
          </Text>
          <Text style={{ ...webType.small, color: colors.ink }}>{weekRange(week)}</Text>
        </View>
        <WebWeekPills week={week} today={today} marks={marks} picked={picked} onPick={onPick} />
        <Text style={{ ...webType.tiny, color: ON_LAVENDER_MUTED }}>
          Pick a day to see the team&apos;s logs for it.
        </Text>
      </View>
    </View>
  );
}

function Tag({ text }: { text: string }): JSX.Element {
  return (
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
      <Text style={{ ...webType.tiny, fontWeight: "700", color: colors.ink }}>{text}</Text>
    </View>
  );
}

/** A black pill on the lavender hero ("Write today's log"); a wash fades in on hover. */
function InkButton({ label, onPress }: { label: string; onPress: () => void }): JSX.Element {
  const [hovered, hover] = useHover();
  const wash = useRef<ComponentRef<typeof View>>(null);
  useTweenTo(wash, { opacity: hovered ? 1 : 0 }, 0.2);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      {...hover}
      style={{
        borderRadius: 999,
        paddingHorizontal: 20,
        paddingVertical: 11,
        backgroundColor: colors.ink,
        overflow: "hidden",
      }}
    >
      <View
        ref={wash}
        style={[StyleSheet.absoluteFill, { opacity: 0, backgroundColor: "rgba(255,255,255,0.16)" }]}
      />
      <Text style={{ ...webType.body, fontWeight: "700", color: colors.white }}>{label}</Text>
    </Pressable>
  );
}

/**
 * One person on the team's day: avatar, name and title, how the day went, and their log. A wash
 * fades in on hover; the row opens their logs (the log's task pills open the task).
 */
function PersonRow({
  person,
  mark,
  isYou,
  onOpen,
  onOpenTask,
}: {
  person: DayPerson;
  mark: ReturnType<typeof markFor>;
  isYou: boolean;
  onOpen: () => void;
  onOpenTask: (taskId: string) => void;
}): JSX.Element {
  const c = usePageColors();
  const [hovered, hover] = useHover();
  const wash = useRef<ComponentRef<typeof View>>(null);
  useTweenTo(wash, { opacity: hovered ? 1 : 0 }, 0.2);
  const { user, log } = person;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${user.name}${isYou ? " (you)" : ""}, ${MARK_WORDS[mark]}`}
      accessibilityHint="Opens their logs"
      onPress={onOpen}
      {...hover}
      style={{
        flexDirection: "row",
        gap: 16,
        padding: 14,
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <View
        ref={wash}
        style={[StyleSheet.absoluteFill, { opacity: 0, backgroundColor: c.panelRaised }]}
      />
      <Avatar size={40} fill={pastelFor(user._id)} name={user.name} dim={!user.isActive} />
      <View style={{ width: 180, gap: 2 }}>
        <Text numberOfLines={1} style={{ ...webType.body, fontWeight: "700", color: c.text }}>
          {user.name}
          {isYou ? <Text style={{ fontWeight: "400", color: c.muted }}> · you</Text> : null}
        </Text>
        <Text numberOfLines={1} style={{ ...webType.small, color: c.muted }}>
          {user.title}
        </Text>
        <View style={{ paddingTop: 6 }}>
          <WebMarkPill mark={mark} />
        </View>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {log ? (
          <WebLogContent log={log} ink={c.text} muted={c.muted} onOpenTask={onOpenTask} />
        ) : (
          <Text style={{ ...webType.body, color: c.muted, paddingTop: 2 }}>
            {mark === "missed"
              ? "No log that weekday."
              : mark === "open"
                ? "Hasn't logged yet today."
                : "No log."}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/**
 * The team's week at a glance: a row per person, a dot per day (green logged, rose missed,
 * a lavender ring for today still open, faint for days to come). A row opens their logs.
 */
function WeekGrid({
  week,
  today,
  teamWeek,
  youId,
  onOpenPerson,
}: {
  week: string[];
  today: string;
  teamWeek: (TeamDay | undefined)[];
  youId: string;
  onOpenPerson: (userId: string) => void;
}): JSX.Element {
  const c = usePageColors();
  // Everyone who appears on any day of the week, you first, then by name.
  const people = new Map<string, DayPerson["user"]>();
  for (const day of teamWeek) for (const p of day?.people ?? []) people.set(p.user._id, p.user);
  const rows = [...people.values()].sort(
    (a, b) => Number(b._id === youId) - Number(a._id === youId) || a.name.localeCompare(b.name)
  );
  const loading = teamWeek.some((d) => d === undefined);

  return (
    <Card>
      <View style={{ paddingHorizontal: 12, paddingBottom: 8, gap: 2 }}>
        <Text
          accessibilityRole="header"
          style={{ fontFamily: fonts.extraBold, fontSize: 16, letterSpacing: -0.3, color: c.text }}
        >
          This week
        </Text>
        <Text style={{ ...webType.small, color: c.muted }}>{weekRange(week)}</Text>
      </View>
      <View style={{ flexDirection: "row", paddingHorizontal: 12, paddingBottom: 4 }}>
        <View style={{ flex: 1 }} />
        {week.map((date) => (
          <Text
            key={date}
            style={{
              ...webType.tiny,
              width: 30,
              textAlign: "center",
              fontWeight: date === today ? "800" : "500",
              color: date === today ? c.text : c.muted,
            }}
          >
            {dayParts(date).short.slice(0, 2)}
          </Text>
        ))}
      </View>
      {loading && rows.length === 0 ? (
        <ActivityIndicator color={c.text} style={{ paddingVertical: 24 }} />
      ) : (
        rows.map((person) => {
          const marks = week.map((date, i) =>
            markFor(
              date,
              today,
              teamWeek[i]?.people.find((p) => p.user._id === person._id)
            )
          );
          return (
            <GridRow
              key={person._id}
              name={person._id === youId ? "You" : person.name.split(" ")[0]}
              fill={pastelFor(person._id)}
              fullName={person.name}
              week={week}
              marks={marks}
              onPress={() => onOpenPerson(person._id)}
            />
          );
        })
      )}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
          paddingHorizontal: 12,
          paddingTop: 10,
        }}
      >
        {(["logged", "missed", "open"] as const).map((mark) => (
          <View key={mark} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Dot mark={mark} />
            <Text style={{ ...webType.tiny, color: c.muted }}>{MARK_WORDS[mark]}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function GridRow({
  name,
  fullName,
  fill,
  week,
  marks,
  onPress,
}: {
  name: string;
  fullName: string;
  fill: string;
  week: string[];
  marks: ReturnType<typeof markFor>[];
  onPress: () => void;
}): JSX.Element {
  const c = usePageColors();
  const [hovered, hover] = useHover();
  const wash = useRef<ComponentRef<typeof View>>(null);
  useTweenTo(wash, { opacity: hovered ? 1 : 0 }, 0.2);
  const spoken = week
    .map((date, i) => `${spokenDay(date).split(" ")[0]} ${MARK_WORDS[marks[i]].toLowerCase()}`)
    .join(", ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${fullName}: ${spoken}`}
      accessibilityHint="Opens their logs"
      onPress={onPress}
      {...hover}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <View
        ref={wash}
        style={[StyleSheet.absoluteFill, { opacity: 0, backgroundColor: c.panelRaised }]}
      />
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 }}>
        <Avatar size={24} fill={fill} name={fullName} />
        <Text
          numberOfLines={1}
          style={{ ...webType.small, fontWeight: "600", color: c.text, flexShrink: 1 }}
        >
          {name}
        </Text>
      </View>
      {marks.map((mark, i) => (
        <View key={week[i]} style={{ width: 30, alignItems: "center" }}>
          <Dot mark={mark} />
        </View>
      ))}
    </Pressable>
  );
}

/** A day's dot in the grid. */
function Dot({ mark }: { mark: ReturnType<typeof markFor> }): JSX.Element {
  const c = usePageColors();
  const tone = MARK_COLORS[mark];
  const filled = mark === "logged" || mark === "missed";
  return (
    <View
      style={{
        width: 12,
        height: 12,
        borderRadius: 999,
        backgroundColor: filled ? tone.fill : "transparent",
        borderWidth: mark === "open" ? 2 : 1,
        borderColor: mark === "open" ? colors.lavenderStrong : filled ? tone.fill : c.hairline,
      }}
    />
  );
}
