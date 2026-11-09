import { useQuery } from "convex/react";
import { useIsFocused, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState, type JSX } from "react";
import { ActivityIndicator, Pressable, Text, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedScrollHandler,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { LiveTaskStatus } from "@convex/lib/validators";

import { Bento, type QuickFilter } from "@/components/board/bento";
import { colors, fonts, MAX_BOARD_WIDTH, REFERENCE_WIDTH } from "@/components/board/board-theme";
import {
  computeBoardStats,
  isDueSoon,
  isOverdue,
  type BoardGroup,
} from "@/components/board/board-stats";
import { FeatureFeed } from "@/components/board/feature-feed";
import { PIT, PIT_DURATION, PULL_TRIGGER } from "@/components/board/pit-stop";
import { OptionPicker } from "@/components/planning/option-picker";
import { LIVE_STATUS_ORDER, TASK_STATUS_LABELS } from "@/constants/labels";
import { useSignedInUser } from "@/lib/use-current-user";
import { useNow } from "@/lib/use-now";

/** When the Board first appears, the pit stop starts with every tile already off-screen. */
const INTRO_START = PIT.brace + PIT.exit;

/**
 * The shared board, styled after the "Paddock Widget Bento" block: a bento of live stats on
 * black, then every feature and its tasks. Pull down past the top to replay the pit stop.
 */
export default function BoardScreen(): JSX.Element {
  const user = useSignedInUser();
  const isAdmin = user.role === "admin";
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const reduceMotion = useReducedMotion();
  const now = useNow();
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth, MAX_BOARD_WIDTH);
  const s = width / REFERENCE_WIDTH;

  const [ownerId, setOwnerId] = useState<Id<"users"> | null>(null);
  const [featureId, setFeatureId] = useState<Id<"features"> | null>(null);
  const [status, setStatus] = useState<LiveTaskStatus | null>(null);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>(null);
  const [showGuide, setShowGuide] = useState(true);

  const serverFiltered = ownerId !== null || featureId !== null || status !== null;
  // The bento always shows the whole team; the feed below follows the filters.
  const board = useQuery(api.tasks.board, {});
  const filteredBoard = useQuery(
    api.tasks.board,
    serverFiltered
      ? {
          ...(ownerId !== null ? { ownerId } : {}),
          ...(featureId !== null ? { featureId } : {}),
          ...(status !== null ? { status } : {}),
        }
      : "skip"
  );
  const proposals = useQuery(api.tasks.proposals);
  const users = useQuery(api.users.list);
  const features = useQuery(api.features.list);

  // -1 = at rest; otherwise seconds into the pit stop.
  const pit = useSharedValue(reduceMotion ? -1 : INTRO_START);
  const introPlayed = useRef(false);
  useEffect(() => {
    if (board === undefined || introPlayed.current) return;
    introPlayed.current = true;
    if (reduceMotion) {
      pit.set(-1);
      return;
    }
    pit.set(INTRO_START);
    pit.set(
      withTiming(
        PIT_DURATION,
        { duration: (PIT_DURATION - INTRO_START) * 1000, easing: Easing.linear },
        (finished) => {
          if (finished) pit.set(-1);
        }
      )
    );
  }, [board, reduceMotion, pit]);

  // Pull the feed down past its top and let go: the crew rebuilds the bento.
  const scrollHandler = useAnimatedScrollHandler({
    onEndDrag: (event) => {
      if (reduceMotion || pit.get() >= 0) return;
      if (event.contentOffset.y > -PULL_TRIGGER * s) return;
      pit.set(0);
      pit.set(
        withTiming(
          PIT_DURATION,
          { duration: PIT_DURATION * 1000, easing: Easing.linear },
          (finished) => {
            if (finished) pit.set(-1);
          }
        )
      );
    },
  });

  const source = serverFiltered ? filteredBoard : board;
  const feed: BoardGroup[] | undefined = source?.flatMap((group) => {
    if (quickFilter === null) return [group];
    const tasks = group.tasks.filter((task) =>
      quickFilter === "overdue" ? isOverdue(task, now) : isDueSoon(task, now)
    );
    return tasks.length > 0 ? [{ ...group, tasks }] : [];
  });
  const isFiltered = serverFiltered || quickFilter !== null;
  const openTask = (taskId: string) =>
    router.push({ pathname: "/tasks/[taskId]", params: { taskId } });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {isFocused ? <StatusBar style="light" /> : null}
      <Animated.ScrollView
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        alwaysBounceVertical
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: 32,
          alignItems: "center",
        }}
      >
        <View style={{ width, gap: 18 }}>
          <View style={{ paddingHorizontal: 10 * s + 4 }}>
            <Text style={{ fontFamily: fonts.semibold, fontSize: 13, color: colors.secondary }}>
              {new Date(now).toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </Text>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: fonts.black,
                fontSize: 34,
                letterSpacing: -1,
                color: colors.white,
              }}
            >
              board
            </Text>
          </View>

          {board === undefined || proposals === undefined ? (
            <ActivityIndicator color={colors.white} style={{ paddingVertical: 80 }} />
          ) : (
            <Bento
              s={s}
              pit={pit}
              stats={computeBoardStats(board, now, user._id)}
              waiting={proposals.proposals.length}
              now={now}
              isAdmin={isAdmin}
              quickFilter={quickFilter}
              onQuickFilter={setQuickFilter}
              showGuide={showGuide}
              onCloseGuide={() => setShowGuide(false)}
              onOpenTask={openTask}
              onOpenWaiting={() => router.push(isAdmin ? "/admin" : "/my-tasks")}
              onOpenMyTasks={() => router.push("/my-tasks")}
              onAction={() => router.push(isAdmin ? "/features/new" : "/tasks/new")}
            />
          )}

          <View style={{ paddingHorizontal: 10 * s, gap: 12 }}>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: fonts.black,
                fontSize: 28,
                letterSpacing: -0.8,
                color: colors.white,
                paddingHorizontal: 4,
              }}
            >
              features
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <OptionPicker
                variant="chip"
                tone="dark"
                label="Owner"
                value={ownerId}
                options={(users ?? []).map((u) => ({
                  value: u._id,
                  label: u.name,
                  description: u.title,
                }))}
                onChange={setOwnerId}
                placeholder="Owner"
                clearLabel="Everyone"
              />
              <OptionPicker
                variant="chip"
                tone="dark"
                label="Feature"
                value={featureId}
                options={(features ?? []).map((f) => ({ value: f._id, label: f.title }))}
                onChange={setFeatureId}
                placeholder="Feature"
                clearLabel="All features"
              />
              <OptionPicker
                variant="chip"
                tone="dark"
                label="Status"
                value={status}
                options={LIVE_STATUS_ORDER.map((st) => ({
                  value: st,
                  label: TASK_STATUS_LABELS[st],
                }))}
                onChange={setStatus}
                placeholder="Status"
                clearLabel="Any status"
              />
              {isFiltered ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setOwnerId(null);
                    setFeatureId(null);
                    setStatus(null);
                    setQuickFilter(null);
                  }}
                  style={({ pressed }) => ({
                    paddingHorizontal: 8,
                    paddingVertical: 6,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.yellow }}>
                    Clear
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {feed === undefined ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <FeatureFeed
                groups={feed}
                now={now}
                emptyMessage={
                  isFiltered
                    ? "No tasks match these filters."
                    : isAdmin
                      ? "Nothing planned yet. Start with “New feature”."
                      : "Nothing planned yet. The admin adds features after each meeting."
                }
                onOpenFeature={(id) =>
                  router.push({ pathname: "/features/[featureId]", params: { featureId: id } })
                }
                onOpenTask={openTask}
              />
            )}
          </View>
        </View>
      </Animated.ScrollView>
    </View>
  );
}
