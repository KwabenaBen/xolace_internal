import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useState, type JSX } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import { api } from "@convex/_generated/api";
import type { LiveTaskStatus } from "@convex/lib/validators";
import type { UserSummary } from "@convex/lib/views";

import { computeBoardStats, plural, type BoardGroup } from "@/components/board/board-stats";
import { OptionPicker } from "@/components/planning/option-picker";
import { colors, fonts, usePageColors } from "@/components/ui/theme";
import { LIVE_STATUS_ORDER, TASK_STATUS_LABELS } from "@/constants/labels";
import { useSignedInUser, type CurrentUser } from "@/lib/use-current-user";
import { useNow } from "@/lib/use-now";

import { useHover } from "../use-hover";
import { webType } from "../web-theme";

import { BoardHeader } from "./board-header";
import {
  isFiltering,
  NO_FILTER,
  upcomingTasks,
  visibleFeatures,
  type BoardFilter,
} from "./board-filter";
import { ComingUpTable } from "./coming-up-table";
import { FeatureCard } from "./feature-card";
import { GlanceCard } from "./glance-card";
import { NextUpCard } from "./next-up-card";

/** The web Board's widest; past this it centres. */
const BOARD_MAX_WIDTH = 1280;
const GAP = 20;
/**
 * The layout changes with the browser window's width only, never the sidebar's: collapsing or
 * opening the sidebar just stretches the page (widths are percentages and flex, so the browser
 * reflows it smoothly as the sidebar glides), with no cards jumping between rows.
 * From this window width the cards go three to a row (else two)...
 */
const THREE_CARDS = 1200;
/** ...and the task table sits beside "Next up" (else below it). */
const SIDE_BY_SIDE = 1400;
/** The column beside the table. */
const SIDE_WIDTH = 360;

/** A filter chip, after the reference's: a solid ink pill when on, an outline when off. */
function Chip({
  label,
  fullLabel,
  selected,
  onPress,
}: {
  label: string;
  /** What screen readers hear, when the chip shows less (a first name). */
  fullLabel?: string;
  selected: boolean;
  onPress: () => void;
}): JSX.Element {
  const c = usePageColors();
  const [hovered, hover] = useHover();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={fullLabel ?? label}
      accessibilityState={{ selected }}
      onPress={onPress}
      {...hover}
      style={{
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? c.accent : hovered ? c.text : c.hairline,
        backgroundColor: selected ? c.accent : "transparent",
        paddingHorizontal: 16,
        paddingVertical: 8,
      }}
    >
      <Text
        style={{
          ...webType.small,
          fontWeight: "600",
          color: selected ? c.accentText : c.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The Board on the website layout (a wide browser window), after the "Learnify" dashboard the
 * team picked on Pinterest: a header with search, the title with a chip per person, the
 * unshipped features as pastel cards, then the open tasks as a table beside the feature that's
 * next up and the team's numbers. The phone keeps its bento (src/components/board/).
 */
export function WebBoard(): JSX.Element {
  const user = useSignedInUser();
  const board = useQuery(api.tasks.board, {});
  const waiting = useQuery(api.tasks.waitingCount);
  const users = useQuery(api.users.list);
  return <WebBoardView user={user} board={board} waiting={waiting} users={users} />;
}

/** The web Board from its data (`undefined` while loading). */
export function WebBoardView({
  user,
  board,
  waiting,
  users,
}: {
  user: CurrentUser;
  board: BoardGroup[] | undefined;
  waiting: { proposals: number; extensions: number } | undefined;
  users: UserSummary[] | undefined;
}): JSX.Element {
  const isAdmin = user.role === "admin";
  const router = useRouter();
  const c = usePageColors();
  const now = useNow();
  const [filter, setFilter] = useState<BoardFilter>(NO_FILTER);
  const { width: windowWidth } = useWindowDimensions();

  const update = (patch: Partial<BoardFilter>) => setFilter({ ...filter, ...patch });
  const filtered = isFiltering(filter);
  const wide = windowWidth >= SIDE_BY_SIDE;
  const columns = windowWidth >= THREE_CARDS ? 3 : 2;

  // You first, then everyone else still on the team, by name.
  const people = [...(users ?? [])]
    .filter((u) => u.isActive && u._id !== user._id)
    .sort((a, b) => a.name.localeCompare(b.name));

  const openFeature = (featureId: string) =>
    router.push({ pathname: "/features/[featureId]", params: { featureId } });
  const openTask = (taskId: string) =>
    router.push({ pathname: "/tasks/[taskId]", params: { taskId } });

  const stats = board === undefined ? null : computeBoardStats(board, now, user._id);
  const cards = board === undefined ? [] : visibleFeatures(board, filter);
  const rows = board === undefined ? [] : upcomingTasks(board, filter);
  const nextGroup =
    stats?.nextUp == null
      ? undefined
      : board?.find((g) => g.feature._id === stats.nextUp?.feature._id);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.page }}
      contentContainerStyle={{ paddingHorizontal: 36, paddingTop: 24, paddingBottom: 56 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ width: "100%", maxWidth: BOARD_MAX_WIDTH, alignSelf: "center", gap: 28 }}>
        <BoardHeader
          user={user}
          now={now}
          query={filter.query}
          onQueryChange={(query) => update({ query })}
          onOpenActivity={() => router.push("/activity")}
          onOpenAccount={() => router.push("/settings/account")}
        />

        {/* Title, the action, then the filters. */}
        <View style={{ gap: 16 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: fonts.black,
                fontSize: 44,
                lineHeight: 50,
                letterSpacing: -1.4,
                color: c.text,
              }}
            >
              Board
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(isAdmin ? "/features/new" : "/tasks/new")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                borderRadius: 999,
                paddingHorizontal: 18,
                paddingVertical: 11,
                backgroundColor: c.accent,
              }}
              className="active:opacity-70"
            >
              <Ionicons name="add" size={18} color={c.accentText} />
              <Text style={{ ...webType.body, fontWeight: "700", color: c.accentText }}>
                {isAdmin ? "New feature" : "Propose a task"}
              </Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <Chip
              label="Everyone"
              selected={filter.ownerId === null}
              onPress={() => update({ ownerId: null })}
            />
            <Chip
              label="You"
              selected={filter.ownerId === user._id}
              onPress={() => update({ ownerId: user._id })}
            />
            {people.map((person) => (
              <Chip
                key={person._id}
                label={person.name.trim().split(/\s+/)[0] ?? person.name}
                fullLabel={person.name}
                selected={filter.ownerId === person._id}
                onPress={() => update({ ownerId: person._id })}
              />
            ))}
            <View
              style={{ width: 1, height: 22, backgroundColor: c.hairline, marginHorizontal: 6 }}
            />
            <OptionPicker<LiveTaskStatus>
              variant="chip"
              label="Status"
              value={filter.status}
              options={LIVE_STATUS_ORDER.map((st) => ({
                value: st,
                label: TASK_STATUS_LABELS[st],
              }))}
              onChange={(status) => update({ status })}
              placeholder="Any status"
              clearLabel="Any status"
            />
            {filtered ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setFilter(NO_FILTER)}
                hitSlop={6}
                style={{ paddingHorizontal: 8, paddingVertical: 6 }}
                className="active:opacity-60"
              >
                <Text
                  style={{
                    ...webType.small,
                    fontWeight: "600",
                    color: c.text,
                    textDecorationLine: "underline",
                  }}
                >
                  Clear
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {board === undefined || waiting === undefined || stats === null ? (
          <ActivityIndicator color={c.text} style={{ paddingVertical: 120 }} />
        ) : (
          <>
            {/* The features. */}
            <View style={{ gap: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
                <Text
                  accessibilityRole="header"
                  style={{
                    fontFamily: fonts.extraBold,
                    fontSize: 20,
                    letterSpacing: -0.4,
                    color: c.text,
                  }}
                >
                  Features
                </Text>
                <Text style={{ ...webType.small, color: c.muted }}>
                  {filtered
                    ? `${cards.length} of ${board.length} match`
                    : `${plural(board.length, "feature")} in the works`}
                </Text>
              </View>
              {cards.length === 0 ? (
                <View
                  style={{
                    borderRadius: 22,
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: c.hairline,
                    paddingVertical: 36,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ ...webType.body, color: c.muted }}>
                    {filtered
                      ? "No features match these filters."
                      : isAdmin
                        ? "Nothing planned yet. Start with “New feature”."
                        : "Nothing planned yet. The admin adds features after each meeting."}
                  </Text>
                </View>
              ) : (
                // Each card a share of the row (half or a third), the gap split either side of
                // it: percentages, so the row stretches with the page.
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    rowGap: GAP,
                    marginHorizontal: -GAP / 2,
                  }}
                >
                  {cards.map((group) => (
                    <View
                      key={group.feature._id}
                      style={{
                        width: columns === 3 ? "33.333%" : "50%",
                        paddingHorizontal: GAP / 2,
                      }}
                    >
                      <FeatureCard
                        group={group}
                        now={now}
                        onOpen={() => openFeature(group.feature._id)}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* The tasks, beside what's next and the team's numbers (narrower: those two first,
                side by side, then the tasks). Rendered in the order they appear, so Tab follows
                the screen. */}
            <View
              style={{ flexDirection: wide ? "row" : "column", alignItems: "flex-start", gap: GAP }}
            >
              {wide ? (
                <View style={{ flex: 1, minWidth: 0 }}>
                  <ComingUpTable
                    rows={rows}
                    now={now}
                    filtered={filtered}
                    onOpenTask={openTask}
                    onClearFilters={() => setFilter(NO_FILTER)}
                  />
                </View>
              ) : null}
              <View
                style={{
                  width: wide ? SIDE_WIDTH : "100%",
                  flexDirection: wide ? "column" : "row",
                  alignItems: wide ? undefined : "flex-start",
                  gap: GAP,
                }}
              >
                <View style={wide ? undefined : { flex: 1, minWidth: 0 }}>
                  <NextUpCard
                    next={stats.nextUp}
                    tasks={nextGroup?.tasks ?? []}
                    now={now}
                    isAdmin={isAdmin}
                    onOpen={() => {
                      if (stats.nextUp !== null) openFeature(stats.nextUp.feature._id);
                    }}
                    onNewFeature={() => router.push("/features/new")}
                  />
                </View>
                <View style={wide ? undefined : { flex: 1, minWidth: 0 }}>
                  <GlanceCard
                    items={[
                      {
                        label: "Overdue",
                        count: stats.overdue.length,
                        dot: colors.red,
                        onOpen: () =>
                          router.push({ pathname: "/board/[view]", params: { view: "overdue" } }),
                      },
                      {
                        label: "Due this week",
                        count: stats.dueSoon.length,
                        dot: colors.yellow,
                        onOpen: () =>
                          router.push({
                            pathname: "/board/[view]",
                            params: { view: "due-this-week" },
                          }),
                      },
                      {
                        label: "Waiting for a decision",
                        count: waiting.proposals + waiting.extensions,
                        dot: colors.lavender,
                        onOpen: () =>
                          router.push({ pathname: "/board/[view]", params: { view: "waiting" } }),
                      },
                      {
                        label: "Your open tasks",
                        count: stats.myOpen,
                        dot: colors.sky,
                        onOpen: () => router.push("/my-tasks"),
                      },
                    ]}
                  />
                </View>
              </View>
              {wide ? null : (
                <View style={{ width: "100%" }}>
                  <ComingUpTable
                    rows={rows}
                    now={now}
                    filtered={filtered}
                    onOpenTask={openTask}
                    onClearFilters={() => setFilter(NO_FILTER)}
                  />
                </View>
              )}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}
