import { useQuery } from "convex/react";
import { Stack, useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { JSX } from "react";
import { ActivityIndicator, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@convex/_generated/api";

import {
  BOARD_LISTS,
  boardGroupsFor,
  isBoardListView,
  proposalGroups,
} from "@/components/board/board-lists";
import { plural, type BoardGroup } from "@/components/board/board-stats";
import { colors, fonts, MAX_BOARD_WIDTH } from "@/components/board/board-theme";
import { FeatureFeed } from "@/components/board/feature-feed";
import { useNow } from "@/lib/use-now";

/**
 * The tasks behind one of the Board's quick tiles — due this week, overdue, or proposals
 * waiting — grouped by feature, in the Board's black style.
 */
export default function BoardListScreen(): JSX.Element {
  const { view } = useLocalSearchParams<{ view: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const now = useNow();
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth, MAX_BOARD_WIDTH);
  const known = isBoardListView(view);

  const board = useQuery(api.tasks.board, known && view !== "waiting" ? {} : "skip");
  const proposals = useQuery(api.tasks.proposals, view === "waiting" ? {} : "skip");

  let groups: BoardGroup[] | undefined;
  if (known) {
    groups =
      view === "waiting"
        ? proposals && proposalGroups(proposals.proposals, proposals.features)
        : board && boardGroupsFor(view, board, now);
  }
  const copy = known ? BOARD_LISTS[view] : null;
  const count = groups?.reduce((sum, group) => sum + group.tasks.length, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: copy?.title ?? "Board" }} />
      {isFocused ? <StatusBar style="light" /> : null}
      <ScrollView
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: insets.bottom + 32,
          alignItems: "center",
        }}
      >
        <View style={{ width, paddingHorizontal: 14, gap: 16 }}>
          {copy === null ? (
            <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: colors.secondary }}>
              This list doesn&apos;t exist.
            </Text>
          ) : (
            <>
              <View style={{ gap: 4, paddingHorizontal: 4 }}>
                <Text
                  accessibilityRole="header"
                  style={{
                    fontFamily: fonts.black,
                    fontSize: 34,
                    letterSpacing: -1,
                    color: colors.white,
                  }}
                >
                  {copy.title}
                </Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.secondary }}>
                  {count !== undefined
                    ? `${plural(count, view === "waiting" ? "proposal" : "task")} · ${copy.subtitle}`
                    : copy.subtitle}
                </Text>
              </View>
              {groups === undefined ? (
                <ActivityIndicator color={colors.white} style={{ paddingVertical: 40 }} />
              ) : (
                <FeatureFeed
                  groups={groups}
                  now={now}
                  emptyMessage={copy.empty}
                  onOpenFeature={(featureId) =>
                    router.push({ pathname: "/features/[featureId]", params: { featureId } })
                  }
                  onOpenTask={(taskId) =>
                    router.push({ pathname: "/tasks/[taskId]", params: { taskId } })
                  }
                />
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
