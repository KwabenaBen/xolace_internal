import { Ionicons } from "@expo/vector-icons";
import { useRef, type ComponentRef, type JSX } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  dayParts,
  MARK_WORDS,
  spokenDay,
  type DayMark,
  type LogView,
} from "@/components/logs/log-days";
import { MARK_COLORS } from "@/components/logs/mark-colors";
import { colors, STATUS_COLORS, usePageColors } from "@/components/ui/theme";
import { TASK_STATUS_LABELS } from "@/constants/labels";

import { useHoverLift, usePressScale, useTweenTo } from "../motion";
import { useHover } from "../use-hover";
import { webType } from "../web-theme";

/**
 * A log on the website: what they did, what's next and what's in the way (a red dot), then the
 * tasks it was about as pills that open the task. `ink`/`muted` let it sit on a pastel or a panel.
 */
export function WebLogContent({
  log,
  ink,
  muted,
  onOpenTask,
}: {
  log: LogView;
  ink: string;
  muted: string;
  onOpenTask?: (taskId: string) => void;
}): JSX.Element {
  const part = (label: string, text: string | undefined, warn = false) =>
    text === undefined || text === "" ? null : (
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {warn ? (
            <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: colors.red }} />
          ) : null}
          <Text
            style={{
              ...webType.tiny,
              fontWeight: "700",
              letterSpacing: 0.5,
              textTransform: "uppercase",
              color: warn ? ink : muted,
            }}
          >
            {label}
          </Text>
        </View>
        <Text style={{ ...webType.body, fontSize: 15, lineHeight: 23, color: ink }}>{text}</Text>
      </View>
    );
  return (
    <View style={{ gap: 12 }}>
      {log.isWeekend ? (
        <Text style={{ ...webType.body, fontSize: 15, lineHeight: 23, color: ink }}>
          {log.done}
        </Text>
      ) : (
        <>
          {part("Did", log.done)}
          {part("Next", log.next)}
          {part("Blocked by", log.blockers, true)}
        </>
      )}
      {log.tasks.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {log.tasks.map((task) => (
            <TaskPill
              key={task._id}
              title={task.title}
              status={task.status}
              onPress={onOpenTask ? () => onOpenTask(task._id) : undefined}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** A linked task: its status dot and title; a wash fades in on hover, and it opens the task. */
function TaskPill({
  title,
  status,
  onPress,
}: {
  title: string;
  status: LogView["tasks"][number]["status"];
  onPress?: () => void;
}): JSX.Element {
  const [hovered, hover] = useHover();
  const pill = useRef<ComponentRef<typeof Pressable>>(null);
  const wash = useRef<ComponentRef<typeof View>>(null);
  const press = usePressScale(pill);
  useTweenTo(wash, { opacity: hovered && onPress ? 1 : 0 }, 0.18);
  return (
    <Pressable
      ref={pill}
      accessibilityRole={onPress ? "link" : undefined}
      accessibilityLabel={`${title}, ${TASK_STATUS_LABELS[status]}`}
      disabled={onPress === undefined}
      onPress={onPress}
      {...press}
      {...hover}
      style={{
        maxWidth: "100%",
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        overflow: "hidden",
        borderRadius: 999,
        paddingHorizontal: 11,
        paddingVertical: 5,
        backgroundColor: colors.tagFill,
        borderWidth: 1,
        borderColor: colors.ink,
      }}
    >
      <View
        ref={wash}
        style={[StyleSheet.absoluteFill, { opacity: 0, backgroundColor: "rgba(17,17,17,0.08)" }]}
      />
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          backgroundColor: STATUS_COLORS[status].fill,
        }}
      />
      <Text
        numberOfLines={1}
        style={{ ...webType.tiny, fontWeight: "600", color: colors.ink, flexShrink: 1 }}
      >
        {title}
      </Text>
    </Pressable>
  );
}

/** A small sticker saying how a day went. */
export function WebMarkPill({ mark }: { mark: DayMark }): JSX.Element {
  const tone = MARK_COLORS[mark];
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 3,
        backgroundColor: tone.fill,
        borderWidth: 1,
        borderColor: tone.border,
      }}
    >
      <Text style={{ ...webType.tiny, fontWeight: "700", color: colors.ink }}>
        {MARK_WORDS[mark]}
      </Text>
    </View>
  );
}

/**
 * A week as seven pills (Monday first), marked like the phone's; each lifts on hover and, when
 * `onPick` is set, picks its day (days still to come can't be picked).
 */
export function WebWeekPills({
  week,
  today,
  marks,
  picked,
  onPick,
}: {
  week: string[];
  today: string;
  marks: DayMark[];
  picked?: string;
  onPick?: (date: string) => void;
}): JSX.Element {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {week.map((date, i) => (
        <DayPill
          key={date}
          date={date}
          mark={marks[i]}
          isToday={date === today}
          isPicked={picked === date}
          onPress={onPick && date <= today ? () => onPick(date) : undefined}
        />
      ))}
    </View>
  );
}

function DayPill({
  date,
  mark,
  isToday,
  isPicked,
  onPress,
}: {
  date: string;
  mark: DayMark;
  isToday: boolean;
  isPicked: boolean;
  onPress?: () => void;
}): JSX.Element {
  const tone = MARK_COLORS[mark];
  const { day, short } = dayParts(date);
  const [hovered, hover] = useHover();
  const pill = useRef<ComponentRef<typeof Pressable>>(null);
  const press = usePressScale(pill);
  useHoverLift(pill, hovered && onPress !== undefined, {
    y: -3,
    shadow: { rest: "0 0 0 rgba(0,0,0,0)", lifted: "0 8px 18px rgba(0,0,0,0.18)" },
  });
  return (
    <Pressable
      ref={pill}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${spokenDay(date)}${isToday ? ", today" : ""}: ${MARK_WORDS[mark]}`}
      accessibilityState={onPress ? { selected: isPicked } : undefined}
      aria-pressed={onPress ? isPicked : undefined}
      disabled={onPress === undefined}
      onPress={onPress}
      {...press}
      {...hover}
      style={{
        flex: 1,
        minWidth: 0,
        height: 74,
        borderRadius: 999,
        borderWidth: isPicked ? 2.5 : 1.5,
        borderColor: isPicked ? colors.ink : tone.border,
        backgroundColor: tone.fill,
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        opacity: mark === "future" ? 0.5 : 1,
      }}
    >
      <Text style={{ ...webType.tiny, fontWeight: "600", color: tone.ink }}>{short}</Text>
      <Text style={{ ...webType.heading, fontSize: 18, fontWeight: "800", color: colors.ink }}>
        {day}
      </Text>
      <View
        style={{
          width: 5,
          height: 5,
          borderRadius: 999,
          backgroundColor: isToday ? colors.ink : "transparent",
        }}
      />
    </Pressable>
  );
}

/** "‹ Yesterday ›": round arrows that step a day back, and forward up to today. */
export function WebDayStepper({
  label,
  spoken,
  onBack,
  onForward,
}: {
  label: string;
  spoken: string;
  onBack: () => void;
  onForward?: () => void;
}): JSX.Element {
  const c = usePageColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <StepArrow icon="chevron-back" label="The day before" onPress={onBack} />
      <Text
        accessibilityLabel={spoken}
        style={{
          ...webType.small,
          fontWeight: "700",
          color: c.text,
          minWidth: 92,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
      <StepArrow icon="chevron-forward" label="The day after" onPress={onForward} />
    </View>
  );
}

function StepArrow({
  icon,
  label,
  onPress,
}: {
  icon: "chevron-back" | "chevron-forward";
  label: string;
  onPress?: () => void;
}): JSX.Element {
  const c = usePageColors();
  const [hovered, hover] = useHover();
  const button = useRef<ComponentRef<typeof Pressable>>(null);
  const wash = useRef<ComponentRef<typeof View>>(null);
  const press = usePressScale(button);
  useTweenTo(wash, { opacity: hovered && onPress ? 1 : 0 }, 0.18);
  return (
    <Pressable
      ref={button}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: onPress === undefined }}
      disabled={onPress === undefined}
      onPress={onPress}
      {...press}
      {...hover}
      style={{
        width: 32,
        height: 32,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: c.hairline,
        backgroundColor: c.panel,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        opacity: onPress === undefined ? 0.35 : 1,
      }}
    >
      <View
        ref={wash}
        style={[StyleSheet.absoluteFill, { opacity: 0, backgroundColor: c.panelRaised }]}
      />
      <Ionicons name={icon} size={16} color={c.text} />
    </Pressable>
  );
}
