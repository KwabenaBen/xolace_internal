import { useEffect, type JSX } from "react";
import { Text, View, type TextStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { longDay, sameDayGmt, shortDay } from "@convex/lib/dates";

import { ProgressBar } from "@/components/ui/progress-bar";
import { colors, fonts } from "@/components/ui/theme";
import { useNow } from "@/lib/use-now";

import { OdometerDigit } from "./odometer";
import { countdown, spokenCountdown, type Countdown } from "./task-dates";

type Tone = { fill: string; ink: string; soft: string; track: string };

const TONES = {
  due: {
    fill: colors.lavender,
    ink: colors.ink,
    soft: "rgba(17,17,17,0.75)",
    track: "rgba(17,17,17,0.14)",
  },
  late: {
    fill: colors.lateCard,
    ink: colors.white,
    soft: "rgba(255,255,255,0.88)",
    track: "rgba(255,255,255,0.28)",
  },
  done: {
    fill: colors.sky,
    ink: colors.ink,
    soft: "rgba(17,17,17,0.75)",
    track: "rgba(17,17,17,0.14)",
  },
  unset: {
    fill: colors.pill,
    ink: colors.ink,
    soft: "rgba(17,17,17,0.75)",
    track: "rgba(17,17,17,0.14)",
  },
} as const satisfies Record<string, Tone>;

export type CountdownCardProps = {
  s: number;
  /** Whose deadline this is; the card says so ("TASK DUE IN", "FEATURE LATE BY"). */
  subject: "Task" | "Feature";
  deadline: number | undefined;
  /** Shown as "originally …" when it differs from `deadline`. */
  originalDeadline?: number;
  /** Set once it's finished (a verified task, a shipped feature): the clock stops. */
  finished?: { verb: "Verified" | "Shipped"; at?: number };
  /** The block's magenta tag, top right (the task's priority). */
  tag?: { text: string; spoken: string };
  /** Shows the URGENT sticker (when it isn't already late or due today). */
  urgent?: boolean;
  progress: number;
  /** Replaces "Progress" beside the bar, e.g. "2 of 5 tasks verified". */
  progressNote?: string;
  /** Another deadline to show after this one, e.g. the feature's: "feature due Thu 12 Nov". */
  alsoDue?: { label: string; at: number };
  /** Shown when there's no deadline yet (a proposal). */
  noDeadlineNote?: string;
};

/**
 * A deadline, as the page's lavender hero card: a live countdown whose digits roll like an
 * odometer (after the Holo Cash Card block's balance), an optional magenta tag, a yellow sticker
 * when it's late, due today or urgent, and the progress bar. Once the deadline passes the card
 * turns red and the clock counts up. It ticks every second on its own, so the rest of the page
 * doesn't. Used for a task's deadline and a feature's.
 */
export function CountdownCard({
  s,
  subject,
  deadline,
  originalDeadline,
  finished,
  tag,
  urgent = false,
  progress,
  progressNote,
  alsoDue,
  noDeadlineNote = "Not set yet",
}: CountdownCardProps): JSX.Element {
  const now = useNow(1000);
  const reduceMotion = useReducedMotion();
  const done = finished !== undefined;
  const clock = deadline !== undefined && !done ? countdown(deadline, now) : null;
  const tone: Tone = done
    ? TONES.done
    : clock === null
      ? TONES.unset
      : clock.late
        ? TONES.late
        : TONES.due;
  const percent = done ? 100 : Math.max(0, Math.min(100, Math.round(progress)));
  const moved =
    deadline !== undefined && originalDeadline !== undefined && originalDeadline !== deadline;
  const who = subject.toUpperCase();

  let sticker: string | null = null;
  if (clock !== null && deadline !== undefined) {
    if (clock.late) sticker = "LATE";
    else if (sameDayGmt(deadline, now)) sticker = "TODAY";
    else if (urgent) sticker = "URGENT";
  }

  let label: string;
  let dueLine: string;
  let spoken: string;
  if (finished !== undefined) {
    label = `${who} ${finished.verb.toUpperCase()}`;
    dueLine =
      finished.at !== undefined ? `${finished.verb} ${shortDay(finished.at, now)}` : finished.verb;
    spoken = `${subject} ${finished.verb.toLowerCase()}${
      finished.at !== undefined ? ` on ${longDay(finished.at)}` : ""
    }.`;
  } else if (clock === null || deadline === undefined) {
    label = `${who} DEADLINE`;
    dueLine = noDeadlineNote;
    spoken = `${subject} deadline: ${noDeadlineNote}.`;
  } else {
    const dueNote =
      alsoDue !== undefined ? `${alsoDue.label} due ${shortDay(alsoDue.at, now)}` : undefined;
    label = `${who} ${clock.late ? "LATE BY" : "DUE IN"}`;
    dueLine = [
      `${clock.late ? "Was due" : "Due"} ${shortDay(deadline, now)}`,
      moved && originalDeadline !== undefined
        ? `originally ${shortDay(originalDeadline, now)}`
        : null,
      dueNote ?? null,
    ]
      .filter((part) => part !== null)
      .join(" · ");
    spoken = `${subject} ${clock.late ? "late by" : "due in"} ${spokenCountdown(clock)}. Deadline ${longDay(deadline)}.${
      dueNote !== undefined ? ` ${dueNote}.` : ""
    }`;
  }
  if (tag !== undefined) spoken += ` ${tag.spoken}.`;
  spoken += ` ${progressNote !== undefined ? `${progressNote}. ` : ""}Progress ${percent} percent.`;

  return (
    <View
      accessible
      accessibilityLabel={spoken}
      style={{
        borderRadius: 30 * s,
        backgroundColor: tone.fill,
        paddingHorizontal: 20 * s,
        paddingTop: 18 * s,
        paddingBottom: 20 * s,
        gap: 12 * s,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text
          maxFontSizeMultiplier={1.3}
          style={{
            flex: 1,
            fontFamily: fonts.extraBold,
            fontSize: 12 * s,
            letterSpacing: 1.2,
            color: tone.soft,
          }}
        >
          {label}
        </Text>
        {tag !== undefined ? (
          <View
            style={{
              borderRadius: 999,
              backgroundColor: colors.magenta,
              paddingHorizontal: 10 * s,
              paddingVertical: 4 * s,
            }}
          >
            <Text
              maxFontSizeMultiplier={1.3}
              style={{ fontFamily: fonts.extraBold, fontSize: 11 * s, color: colors.white }}
            >
              {tag.text}
            </Text>
          </View>
        ) : null}
      </View>

      {clock !== null ? (
        <Clock clock={clock} s={s} ink={tone.ink} soft={tone.soft} animate={!reduceMotion} />
      ) : (
        <Text
          maxFontSizeMultiplier={1.3}
          style={{
            fontFamily: fonts.black,
            fontSize: 34 * s,
            letterSpacing: -1,
            color: tone.ink,
          }}
        >
          {done ? "Done" : "No deadline yet"}
        </Text>
      )}

      <Text
        maxFontSizeMultiplier={1.3}
        style={{ fontFamily: fonts.semibold, fontSize: 13 * s, color: tone.soft }}
      >
        {dueLine}
      </Text>

      <View style={{ gap: 6 * s }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <Text
            maxFontSizeMultiplier={1.3}
            numberOfLines={1}
            style={{ flex: 1, fontFamily: fonts.bold, fontSize: 12 * s, color: tone.soft }}
          >
            {progressNote ?? "Progress"}
          </Text>
          <Text
            maxFontSizeMultiplier={1.3}
            style={{ fontFamily: fonts.extraBold, fontSize: 12 * s, color: tone.ink }}
          >
            {percent}%
          </Text>
        </View>
        <ProgressBar percent={percent} height={8 * s} track={tone.track} fill={tone.ink} />
      </View>

      {sticker !== null ? (
        <Sticker key={sticker} label={sticker} s={s} animate={!reduceMotion} />
      ) : null}
    </View>
  );
}

/** "2d 14h 33m 07s", every digit its own odometer column; seconds in the softer colour. */
function Clock({
  clock,
  s,
  ink,
  soft,
  animate,
}: {
  clock: Countdown;
  s: number;
  ink: string;
  soft: string;
  animate: boolean;
}): JSX.Element {
  const dayDigits = String(clock.days).split("").map(Number);
  // Three-digit days need a little more room.
  const size = (dayDigits.length > 2 ? 40 : 46) * s;
  const digit: TextStyle = { fontFamily: fonts.black, fontSize: size, color: ink };
  const quiet: TextStyle = { ...digit, color: soft };
  const column = { height: Math.round(size * 1.22), width: Math.round(size * 0.66), animate };

  const unit = (text: string, color: string) => (
    <Text
      allowFontScaling={false}
      style={{
        fontFamily: fonts.extraBold,
        fontSize: size * 0.42,
        color,
        marginLeft: 1,
        marginRight: 7 * s,
        marginBottom: size * 0.26,
      }}
    >
      {text}
    </Text>
  );

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
      {dayDigits.map((d, i) => (
        // Keyed from the right, so the units column stays put when the day count loses a digit.
        <OdometerDigit key={`d${dayDigits.length - i}`} digit={d} textStyle={digit} {...column} />
      ))}
      {unit("d", ink)}
      <OdometerDigit
        digit={Math.floor(clock.hours / 10)}
        modulus={3}
        textStyle={digit}
        {...column}
      />
      <OdometerDigit digit={clock.hours % 10} textStyle={digit} {...column} />
      {unit("h", ink)}
      <OdometerDigit
        digit={Math.floor(clock.minutes / 10)}
        modulus={6}
        textStyle={digit}
        {...column}
      />
      <OdometerDigit digit={clock.minutes % 10} textStyle={digit} {...column} />
      {unit("m", ink)}
      <OdometerDigit
        digit={Math.floor(clock.seconds / 10)}
        modulus={6}
        textStyle={quiet}
        {...column}
      />
      <OdometerDigit digit={clock.seconds % 10} textStyle={quiet} {...column} />
      {unit("s", soft)}
    </View>
  );
}

/** The block's yellow BOOST sticker: tilted 12° and popping in with a decaying wobble. */
function Sticker({
  label,
  s,
  animate,
}: {
  label: string;
  s: number;
  animate: boolean;
}): JSX.Element {
  const t = useSharedValue(0);

  useEffect(() => {
    if (!animate) return;
    t.set(withDelay(900, withTiming(1.5, { duration: 1500, easing: Easing.linear })));
  }, [animate, t]);

  const pop = useAnimatedStyle(() => {
    const x = t.get();
    return {
      transform: [{ rotate: "12deg" }, { scale: 1 + 0.16 * Math.sin(22 * x) * Math.exp(-7 * x) }],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          top: -16 * s,
          right: 20 * s,
          borderRadius: 8 * s,
          backgroundColor: colors.sticker,
          paddingHorizontal: 10 * s,
          paddingVertical: 5 * s,
          boxShadow: "0 4px 10px rgba(0,0,0,0.35)",
        },
        pop,
      ]}
    >
      <Text
        allowFontScaling={false}
        style={{
          fontFamily: fonts.black,
          fontSize: 13 * s,
          letterSpacing: 0.6,
          color: colors.ink,
        }}
      >
        {label}
      </Text>
    </Animated.View>
  );
}
