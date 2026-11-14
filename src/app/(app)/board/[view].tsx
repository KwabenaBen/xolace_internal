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
import { SectionTitle } from "@/components/ui/panel";
import { ExtensionRow } from "@/components/task/extension-row";
import { TaskRow } from "@/components/ui/task-row";
import { useNow } from "@/lib/use-now";

/**
 * The tasks behind one of the Board's quick tiles — due this week, overdue, or what's waiting
 * for a decision (requests for more time first, then proposals) — grouped by feature, with the
 * same header as the other detail pages.
 */
export default function BoardListScreen(): JSX.Element {
  const { view } = useLocalSearchParams<{ view: string }>();
  const router = useRouter();
  const goBack = useGoBack();
  const now = useNow();
  const { s, content } = usePageSize();
  const known = isBoardListView(view);

  // The waiting page uses it too, for the tasks in review.
  const board = useQuery(api.tasks.board, known ? {} : "skip");
  const proposals = useQuery(api.tasks.proposals, view === "waiting" ? {} : "skip");
  const extensions = useQuery(api.extensions.pending, view === "waiting" ? {} : "skip");
  const openTask = (taskId: string) =>
    router.push({ pathname: "/tasks/[taskId]", params: { taskId } });

  let groups: BoardGroup[] | undefined;
  if (known) {
    groups =
      view === "waiting"
        ? proposals && proposalGroups(proposals.proposals, proposals.features)
        : board && boardGroupsFor(view, board, now);
  }
  const copy = known ? BOARD_LISTS[view] : null;
  const count = groups?.reduce((sum, group) => sum + group.tasks.length, 0);
  // Tasks with their peer reviewer or a verifier (waiting page only).
  const inReview =
    view === "waiting"
      ? (board ?? []).flatMap((group) =>
          group.tasks
            .filter((task) => task.status === "in_peer_review" || task.status === "submitted")
            .map((task) => ({ task, featureTitle: group.feature.title }))
        )
      : [];

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
                ? `${
                    view === "waiting"
                      ? `${plural(inReview.length, "review")} · ${plural(extensions?.length ?? 0, "request")} · ${plural(count, "proposal")}`
                      : plural(count, "task")
                  } · ${copy.subtitle}`
                : copy.subtitle
            }
            onBack={goBack}
          />
          {inReview.length > 0 ? (
            <View style={{ gap: 12 * s }}>
              <SectionTitle s={s} title="In review" count={inReview.length} />
              {inReview.map(({ task, featureTitle }) => (
                <TaskRow
                  key={task._id}
                  task={task}
                  now={now}
                  featureTitle={featureTitle}
                  onPress={() => openTask(task._id)}
                />
              ))}
              {extensions === undefined || extensions.length === 0 ? (
                <SectionTitle s={s} title="Proposals" count={count} />
              ) : null}
            </View>
          ) : null}
          {view === "waiting" && extensions !== undefined && extensions.length > 0 ? (
            <View style={{ gap: 12 * s }}>
              <SectionTitle s={s} title="More time asked for" count={extensions.length} />
              {extensions.map((item) => (
                <ExtensionRow
                  key={item.request._id}
                  s={s}
                  item={item}
                  now={now}
                  onPress={() => openTask(item.task._id)}
                />
              ))}
              <SectionTitle s={s} title="Proposals" count={count} />
            </View>
          ) : null}
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
              onOpenTask={openTask}
            />
          )}
        </View>
      )}
    </DetailPage>
  );
}
