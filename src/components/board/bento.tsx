import { useId, type JSX, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { formatDeadline, relativeDay } from "@convex/lib/dates";

import { BentoTile } from "./bento-tile";
import { radius, size, space, type } from "./board-theme";
import type { BoardListView } from "./board-lists";
import { plural, type BoardStats } from "./board-stats";
import { TILE } from "./pit-stop";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Sym, symbols, Txt, type SymbolSpec } from "@/components/ui/sym";

import { colors, fonts } from "@/components/ui/theme";

/** Montserrat's ascender per point of size: a line's top is `baseline - ASCENT * size`. */
const ASCENT = 0.968;

type Waiting = { proposals: number; extensions: number; reviews: number };

/** "2 proposals", "1 request" (for more time), "1 review", or "3 pending" when it's a mix. */
function waitingWords({ proposals, extensions, reviews }: Waiting): string {
  const kinds = [proposals, extensions, reviews].filter((n) => n > 0).length;
  if (kinds > 1) return `${proposals + extensions + reviews} pending`;
  if (extensions > 0) return plural(extensions, "request");
  if (reviews > 0) return plural(reviews, "review");
  return plural(proposals, "proposal");
}

type BentoProps = {
  s: number;
  pit: SharedValue<number>;
  stats: BoardStats;
  /** Proposals, requests for more time and reviews waiting for a decision. */
  waiting: Waiting;
  now: number;
  isAdmin: boolean;
  showGuide: boolean;
  onCloseGuide: () => void;
  /** Open a feature's page ("next up"). */
  onOpenFeature: (featureId: string) => void;
  /** Open the page listing a quick tile's tasks. */
  onOpenList: (view: BoardListView) => void;
  onOpenMyTasks: () => void;
  /** The red "team activity" tile: opens the team's activity. */
  onOpenActivity: () => void;
  onAction: () => void;
};

/** A line of tile text placed by its baseline, in reference points (as in the reference). */
function Line({
  text,
  x,
  baseline,
  fontSize,
  family,
  color,
  s,
  tracking = 0,
  maxWidth,
}: {
  text: string;
  x: number;
  baseline: number;
  fontSize: number;
  family: string;
  color: string;
  s: number;
  tracking?: number;
  maxWidth?: number;
}): JSX.Element {
  return (
    <Txt
      numberOfLines={1}
      style={{
        position: "absolute",
        left: x * s,
        top: (baseline - ASCENT * fontSize) * s,
        maxWidth: maxWidth !== undefined ? maxWidth * s : undefined,
        fontFamily: family,
        fontSize: fontSize * s,
        letterSpacing: tracking * s,
        color,
      }}
    >
      {text}
    </Txt>
  );
}

/** A mark centred at (cx, cy), reference points. */
function Mark({
  symbol,
  cx,
  cy,
  iconSize,
  color,
  s,
}: {
  symbol: SymbolSpec;
  cx: number;
  cy: number;
  iconSize: number;
  color: string;
  s: number;
}): JSX.Element {
  return (
    <View
      style={{
        position: "absolute",
        left: (cx - iconSize / 2) * s,
        top: (cy - iconSize / 2) * s,
      }}
    >
      <Sym symbol={symbol} size={iconSize * s} color={color} weight="bold" />
    </View>
  );
}

/** Small eyebrow over a bold title, vertically centred in a quick tile. */
function TileLabel({
  eyebrow,
  title,
  x,
  color,
  s,
}: {
  eyebrow: string;
  title: string;
  x: number;
  color: string;
  s: number;
}): JSX.Element {
  const width = size.column - x - 10;
  return (
    <>
      <Line
        text={eyebrow}
        x={x}
        baseline={25.8}
        fontSize={type.eyebrow}
        family={fonts.semibold}
        tracking={type.eyebrowTracking}
        color={color}
        s={s}
        maxWidth={width}
      />
      <Line
        text={title}
        x={x}
        baseline={44.8}
        fontSize={type.tileTitle}
        family={fonts.bold}
        tracking={type.tileTitleTracking}
        color={color}
        s={s}
        maxWidth={width}
      />
    </>
  );
}

/** The dashboard at the top of the Board, laid out as the reference's bento. */
export function Bento(props: BentoProps): JSX.Element {
  const { s, pit, stats, waiting, now, isAdmin, showGuide } = props;
  const gap = space.rowGap * s;

  return (
    <View style={{ paddingHorizontal: space.screenInset * s, gap }}>
      <View style={{ flexDirection: "row", gap: space.columnGap * s }}>
        <View style={{ gap }}>
          <DueSoonTile
            s={s}
            pit={pit}
            count={stats.dueSoon.length}
            onPress={() => props.onOpenList("due-this-week")}
          />
          <OverdueTile
            s={s}
            pit={pit}
            count={stats.overdue.length}
            onPress={() => props.onOpenList("overdue")}
          />
          <WaitingTile
            s={s}
            pit={pit}
            waiting={waiting}
            onPress={() => props.onOpenList("waiting")}
          />
        </View>
        <NextUpTile s={s} pit={pit} stats={stats} now={now} onOpenFeature={props.onOpenFeature} />
      </View>

      <ProgressTile s={s} pit={pit} stats={stats} />

      <View style={{ flexDirection: "row", gap: space.columnGap * s }}>
        <BentoTile
          index={TILE.myTasks}
          width={size.column}
          height={size.quick}
          corner={radius.quick}
          s={s}
          pit={pit}
          fill={colors.green}
          label={`My tasks: ${plural(stats.myOpen, "open task")}`}
          onPress={props.onOpenMyTasks}
        >
          <Mark
            symbol={symbols.myTasks}
            cx={space.tileMarkCenter}
            cy={31}
            iconSize={type.tileIcon}
            color={colors.black}
            s={s}
          />
          <TileLabel
            eyebrow="assigned to me"
            title={plural(stats.myOpen, "open task")}
            x={space.tileTextAfterMark}
            color={colors.black}
            s={s}
          />
        </BentoTile>
        <BentoTile
          index={TILE.action}
          width={size.column}
          height={size.quick}
          corner={radius.quick}
          s={s}
          pit={pit}
          fill={colors.blue}
          label={isAdmin ? "Plan a new feature" : "Propose a task"}
          onPress={props.onAction}
        >
          <Mark
            symbol={isAdmin ? symbols.newFeature : symbols.propose}
            cx={space.tileMarkCenter}
            cy={31}
            iconSize={type.tileIcon}
            color={colors.cream}
            s={s}
          />
          <TileLabel
            eyebrow={isAdmin ? "plan" : "suggest"}
            title={isAdmin ? "New feature" : "Propose task"}
            x={space.tileTextAfterMark}
            color={colors.white}
            s={s}
          />
        </BentoTile>
      </View>

      <HeroTile s={s} pit={pit} onPress={props.onOpenActivity} />
      {showGuide ? <GuideTile s={s} pit={pit} onClose={props.onCloseGuide} /> : null}
    </View>
  );
}

type QuickTileProps = {
  s: number;
  pit: SharedValue<number>;
  count: number;
  onPress: () => void;
};

function DueSoonTile({ s, pit, count, onPress }: QuickTileProps): JSX.Element {
  return (
    <BentoTile
      index={TILE.dueSoon}
      width={size.column}
      height={size.quick}
      corner={radius.quick}
      s={s}
      pit={pit}
      fill={colors.violet}
      label={`${plural(count, "task")} due this week. Opens the list.`}
      onPress={onPress}
    >
      <View
        style={{
          position: "absolute",
          left: (38.5 - 47.5 / 2) * s,
          top: ((size.quick - 28.5) / 2) * s,
          width: 47.5 * s,
          height: 28.5 * s,
          borderRadius: 14.25 * s,
          borderWidth: 2.5 * s,
          borderColor: colors.white,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Txt
          style={{
            fontFamily: fonts.black,
            fontSize: type.badge * s,
            color: colors.white,
            letterSpacing: -0.4 * s,
          }}
        >
          {count}
        </Txt>
      </View>
      <Line
        text="due this"
        x={71.7}
        baseline={32}
        fontSize={type.violet}
        family={fonts.extraBold}
        tracking={type.violetTracking}
        color={colors.white}
        s={s}
      />
      <Line
        text="week"
        x={71.7}
        baseline={47.5}
        fontSize={type.violet}
        family={fonts.extraBold}
        tracking={type.violetTracking}
        color={colors.white}
        s={s}
      />
    </BentoTile>
  );
}

function OverdueTile({ s, pit, count, onPress }: QuickTileProps): JSX.Element {
  return (
    <BentoTile
      index={TILE.overdue}
      width={size.column}
      height={size.quick}
      corner={radius.quick}
      s={s}
      pit={pit}
      fill={colors.orange}
      label={`${plural(count, "task")} overdue. Opens the list.`}
      onPress={onPress}
    >
      <TileLabel
        eyebrow="overdue"
        title={plural(count, "task")}
        x={space.tileInset}
        color={colors.white}
        s={s}
      />
      <View
        style={{
          position: "absolute",
          right: 14.7 * s,
          top: ((size.quick - 19) / 2) * s,
          width: 30 * s,
          height: 19 * s,
          borderRadius: radius.chip * s,
          borderCurve: "continuous",
          backgroundColor: colors.white,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Sym symbol={symbols.overdue} size={13 * s} color={colors.orange} />
      </View>
    </BentoTile>
  );
}

function WaitingTile({
  s,
  pit,
  waiting,
  onPress,
}: {
  s: number;
  pit: SharedValue<number>;
  waiting: Waiting;
  onPress: () => void;
}): JSX.Element {
  return (
    <BentoTile
      index={TILE.waiting}
      width={size.column}
      height={size.quick}
      corner={radius.quick}
      s={s}
      pit={pit}
      fill={colors.yellow}
      label={`Waiting for a decision: ${plural(waiting.proposals, "proposal")}, ${plural(waiting.extensions, "request")} for more time and ${plural(waiting.reviews, "review")}. Opens the list.`}
      onPress={onPress}
    >
      <Mark
        symbol={symbols.waiting}
        cx={space.tileMarkCenter}
        cy={31}
        iconSize={type.tileIcon}
        color={colors.black}
        s={s}
      />
      <TileLabel
        eyebrow="waiting"
        title={waitingWords(waiting)}
        x={space.tileTextAfterMark}
        color={colors.black}
        s={s}
      />
    </BentoTile>
  );
}

function NextUpTile({
  s,
  pit,
  stats,
  now,
  onOpenFeature,
}: {
  s: number;
  pit: SharedValue<number>;
  stats: BoardStats;
  now: number;
  onOpenFeature: (featureId: string) => void;
}): JSX.Element {
  const next = stats.nextUp;
  const progress = next?.progress;
  const inset = space.cardInset;
  const mark = 42; // a little smaller than the reference's 50, to leave room for the details
  const dateRow = 18; // the calendar row pinned to the bottom
  const label =
    next === null
      ? "Next up: no features planned"
      : `Next up: feature ${next.feature.title}, due ${formatDeadline(next.feature.deadline, now)}, ${relativeDay(next.feature.deadline, now)}. ${
          next.progress.total === 0
            ? "No tasks yet."
            : `${next.progress.verified} of ${plural(next.progress.total, "task")} verified, ${next.progress.percent} percent done.`
        }`;

  return (
    <BentoTile
      index={TILE.nextUp}
      width={size.column}
      height={size.tall}
      corner={radius.card}
      s={s}
      pit={pit}
      fill={colors.cream}
      label={label}
      onPress={next !== null ? () => onOpenFeature(next.feature._id) : undefined}
    >
      <View
        style={{
          position: "absolute",
          left: inset * s,
          top: inset * s,
          width: mark * s,
          height: mark * s,
          borderRadius: 12 * s,
          borderCurve: "continuous",
          backgroundColor: colors.orange,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Sym symbol={symbols.nextUp} size={22 * s} color={colors.micInk} />
      </View>
      {next !== null ? (
        <View
          style={{
            position: "absolute",
            right: 12.5 * s,
            top: 12.5 * s,
            width: size.arrow * s,
            height: size.arrow * s,
            borderRadius: (size.arrow / 2) * s,
            backgroundColor: colors.black,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Sym symbol={symbols.arrowUpRight} size={8 * s} color={colors.white} weight="bold" />
        </View>
      ) : null}

      {/* One column between the mark and the date row, so long titles push nothing off. */}
      <View
        style={{
          position: "absolute",
          left: inset * s,
          right: inset * s,
          top: (inset + mark + 6) * s,
          bottom: (14 + dateRow + 6) * s,
          overflow: "hidden",
        }}
      >
        {/* One text run: the baselines line up, the words keep their space, and the italic's
            overhang gets a few points of room so iOS doesn't clip it. */}
        <Txt
          numberOfLines={1}
          style={{
            fontFamily: fonts.black,
            fontSize: type.cardTitle * s,
            lineHeight: 36 * s,
            letterSpacing: -0.6 * s,
            color: colors.black,
            paddingRight: 4 * s,
          }}
        >
          {"next "}
          <Txt
            style={{
              fontFamily: fonts.serif,
              fontStyle: "italic",
              fontWeight: "600",
              letterSpacing: -0.4 * s,
            }}
          >
            up
          </Txt>
        </Txt>
        <Txt
          numberOfLines={2}
          style={{
            marginTop: 2 * s,
            fontFamily: fonts.semibold,
            fontSize: type.cardSubtitle * s,
            lineHeight: 15 * s,
            color: colors.black,
          }}
        >
          {next?.feature.title ?? "Nothing planned"}
        </Txt>
        <Txt
          numberOfLines={1}
          style={{
            marginTop: 3 * s,
            fontFamily: fonts.medium,
            fontSize: type.cardSmall * s,
            lineHeight: 13 * s,
            color: colors.ink55Black,
          }}
        >
          {progress === undefined
            ? "Plan a feature to start"
            : progress.total === 0
              ? "No tasks yet"
              : `${progress.verified} of ${plural(progress.total, "task")} verified`}
        </Txt>
        {progress !== undefined && progress.total > 0 ? (
          <View
            style={{ marginTop: 5 * s, flexDirection: "row", alignItems: "center", gap: 6 * s }}
          >
            <ProgressBar
              style={{ flex: 1 }}
              percent={progress.percent}
              height={5 * s}
              track={"rgba(0,0,0,0.15)"}
              fill={colors.black}
            />
            <Txt
              style={{
                fontFamily: fonts.extraBold,
                fontSize: type.cardSmall * s,
                color: colors.black,
              }}
            >
              {progress.percent}%
            </Txt>
          </View>
        ) : null}
      </View>

      {next !== null ? (
        <View
          style={{
            position: "absolute",
            left: inset * s,
            right: inset * s,
            bottom: 14 * s,
            height: dateRow * s,
            flexDirection: "row",
            alignItems: "center",
            gap: 6 * s,
          }}
        >
          <Sym symbol={symbols.calendar} size={18 * s} color={colors.black} />
          <Txt style={{ fontFamily: fonts.extraBold, fontSize: 14 * s, color: colors.black }}>
            {formatDeadline(next.feature.deadline, now)}
          </Txt>
          <Txt
            numberOfLines={1}
            style={{
              flexShrink: 1,
              fontFamily: fonts.medium,
              fontSize: type.cardSmall * s,
              color: next.feature.deadline < now ? colors.red : colors.ink55Black,
            }}
          >
            {relativeDay(next.feature.deadline, now)}
          </Txt>
        </View>
      ) : null}
    </BentoTile>
  );
}

function ProgressTile({
  s,
  pit,
  stats,
}: {
  s: number;
  pit: SharedValue<number>;
  stats: BoardStats;
}): JSX.Element {
  const gradientId = `progress-${useId().replace(/:/g, "")}`;
  const c = stats.byStatus;
  const doing = c.in_progress + c.blocked + c.changes_requested;
  const review = c.in_peer_review + c.submitted;
  const rows = [
    { label: "To do", count: c.todo, color: colors.cream },
    { label: "Doing", count: doing, color: colors.blue },
    { label: "Review", count: review, color: colors.violet },
    { label: "Done", count: c.verified, color: colors.green },
  ];
  const max = Math.max(1, ...rows.map((r) => r.count));

  return (
    <BentoTile
      index={TILE.progress}
      width={size.full}
      height={size.stats}
      corner={radius.card}
      s={s}
      pit={pit}
      fill={colors.statsShade}
      label={`Team progress: ${plural(stats.total, "task")}. ${rows.map((r) => `${r.label} ${r.count}`).join(", ")}.`}
    >
      <Svg style={{ position: "absolute", inset: 0 }} width="100%" height="100%">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.statsGlow} />
            <Stop offset="1" stopColor={colors.statsShade} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
      <View style={{ position: "absolute", left: 25 * s, top: 24 * s }}>
        <Sym symbol={symbols.progress} size={46 * s} color={colors.white} />
      </View>
      <Line
        text="the team"
        x={space.statsTextX}
        baseline={22}
        fontSize={type.statsEyebrow}
        family={fonts.bold}
        color={colors.white}
        s={s}
      />
      <Line
        text="Progress"
        x={space.statsTextX}
        baseline={56}
        fontSize={type.statsWord}
        family={fonts.bold}
        color={colors.white}
        s={s}
      />
      <Line
        text={`${plural(stats.total, "task")} · ${c.verified} verified`}
        x={space.statsCaptionX}
        baseline={116}
        fontSize={type.caption}
        family={fonts.medium}
        color={colors.white}
        s={s}
        maxWidth={220}
      />
      <Line
        text={`${doing} in progress · ${c.blocked} blocked`}
        x={space.statsCaptionX}
        baseline={131}
        fontSize={type.caption}
        family={fonts.medium}
        color={colors.white}
        s={s}
        maxWidth={220}
      />
      <View
        style={{
          position: "absolute",
          left: 254 * s,
          top: 15 * s,
          width: 108 * s,
          height: 114 * s,
          justifyContent: "space-between",
        }}
      >
        {rows.map((row) => (
          <View key={row.label} style={{ gap: 3 * s }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Txt style={{ fontFamily: fonts.bold, fontSize: 9 * s, color: colors.secondary }}>
                {row.label}
              </Txt>
              <Txt style={{ fontFamily: fonts.extraBold, fontSize: 9 * s, color: colors.white }}>
                {row.count}
              </Txt>
            </View>
            <View style={{ height: 8 * s, borderRadius: 4 * s, backgroundColor: colors.panel12 }}>
              <View
                style={{
                  width: `${(row.count / max) * 100}%`,
                  minWidth: row.count > 0 ? 8 * s : 0,
                  height: "100%",
                  borderRadius: 4 * s,
                  backgroundColor: row.color,
                }}
              />
            </View>
          </View>
        ))}
      </View>
    </BentoTile>
  );
}

/**
 * The red "team activity" tile: the way into the team's activity (every change, who made it and
 * when). It used to carry Cadence's motto ("every task, one owner"); the team asked for it to say
 * what it opens.
 */
function HeroTile({
  s,
  pit,
  onPress,
}: {
  s: number;
  pit: SharedValue<number>;
  onPress: () => void;
}): JSX.Element {
  const seal = size.seal;
  return (
    <BentoTile
      index={TILE.hero}
      width={size.full}
      height={size.hero}
      corner={radius.card}
      s={s}
      pit={pit}
      fill={colors.red}
      label="Activity: every change, who made it and when."
      onPress={onPress}
    >
      <Line
        text="team"
        x={space.heroFirstX}
        baseline={54}
        fontSize={type.heroGlyph}
        family={fonts.black}
        tracking={-2.4}
        color={colors.rose}
        s={s}
      />
      <Line
        text="activity"
        x={space.heroSecondX}
        baseline={108.8}
        fontSize={type.heroGlyph}
        family={fonts.black}
        tracking={-2.4}
        color={colors.white}
        s={s}
      />
      <View
        style={{
          position: "absolute",
          left: (33 - seal / 2) * s,
          top: (91.2 - seal / 2) * s,
          width: seal * s,
          height: seal * s,
          borderRadius: (seal / 2) * s,
          backgroundColor: colors.white,
          borderWidth: 1,
          borderColor: colors.sealStroke,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Txt
          style={{
            fontFamily: fonts.black,
            fontSize: type.heroSeal * s * 1.35,
            letterSpacing: -0.4 * s,
            color: colors.red,
          }}
        >
          c
        </Txt>
      </View>
      {/* Opens the activity, like the other tiles' arrows. */}
      <View
        style={{
          position: "absolute",
          right: 12.5 * s,
          top: 12.5 * s,
          width: size.arrow * s,
          height: size.arrow * s,
          borderRadius: (size.arrow / 2) * s,
          backgroundColor: colors.black,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Sym symbol={symbols.arrowUpRight} size={8 * s} color={colors.white} weight="bold" />
      </View>
    </BentoTile>
  );
}

function GuideTile({
  s,
  pit,
  onClose,
}: {
  s: number;
  pit: SharedValue<number>;
  onClose: () => void;
}): JSX.Element {
  const close = 18.5;
  return (
    <BentoTile
      index={TILE.guide}
      width={size.full}
      height={size.guide}
      corner={radius.card}
      s={s}
      pit={pit}
      fill={colors.guideYellow}
      label="How the board works. Tap a coloured tile to see its tasks, and a task to open it. Pull down to replay the pit stop."
    >
      <Line
        text="how does it work?"
        x={space.guideInset}
        baseline={46.8}
        fontSize={type.guideTitle}
        family={fonts.extraBold}
        tracking={-0.6}
        color={colors.black}
        s={s}
      />
      <Line
        text="Tap a coloured tile to see its tasks, and a task to"
        x={space.guideInset}
        baseline={70.7}
        fontSize={type.guideHelper}
        family={fonts.medium}
        color={colors.black}
        s={s}
      />
      <Line
        text="open it. Pull the board down to replay the pit stop."
        x={space.guideInset}
        baseline={87.9}
        fontSize={type.guideHelper}
        family={fonts.medium}
        color={colors.black}
        s={s}
      />
      <CloseButton s={s} size={close} onPress={onClose} />
    </BentoTile>
  );
}

function CloseButton({
  s,
  size: diameter,
  onPress,
}: {
  s: number;
  size: number;
  onPress: () => void;
}): ReactNode {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Hide the board guide"
      hitSlop={14 * s}
      onPress={onPress}
      style={{
        position: "absolute",
        right: 12.7 * s,
        top: (21.5 - diameter / 2) * s,
        width: diameter * s,
        height: diameter * s,
        borderRadius: (diameter / 2) * s,
        backgroundColor: colors.closeFill,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Sym symbol={symbols.close} size={7.5 * s} color={colors.white} weight="bold" />
    </Pressable>
  );
}
