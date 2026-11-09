import { useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { JSX } from "react";
import { View } from "react-native";

import { api } from "@convex/_generated/api";

import {
  BOARD_LISTS,
  boardGroupsFor,
  isBoardListView,
  proposalGroups,
} from "@/components/board/board-lists";
import { plural, type BoardGroup } from "@/components/board/board-stats";
import { FeatureFeed } from "@/components/board/feature-feed";
import {
  DetailPage,
  PageLoading,
  PageNotFound,
  useGoBack,
  usePageSize,
} from "@/components/ui/detail-page";
import { PageHeader } from "@/components/ui/page-header";
import { useNow } from "@/lib/use-now";

/**
 * The tasks behind one of the Board's quick tiles — due this week, overdue, or proposals
 * waiting — grouped by feature, with the same header as the other detail pages.
 */
export default function BoardListScreen(): JSX.Element {
  const { view } = useLocalSearchParams<{ view: string }>();
  const router = useRouter();
  const goBack = useGoBack();
  const now = useNow();
  const { s, content } = usePageSize();
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
    <DetailPage title={copy?.title ?? "Board"} content={content}>
      {copy === null ? (
        <PageNotFound s={s} message="This list doesn't exist." onBack={goBack} />
      ) : (
        <View style={{ gap: 22 * s }}>
          <PageHeader
            s={s}
            title={copy.title}
            subtitle={
              count !== undefined
                ? `${plural(count, view === "waiting" ? "proposal" : "task")} · ${copy.subtitle}`
                : copy.subtitle
            }
            onBack={goBack}
          />
          {groups === undefined ? (
            <PageLoading />
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
        </View>
      )}
    </DetailPage>
  );
}
