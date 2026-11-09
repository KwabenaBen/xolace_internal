import { useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { JSX } from "react";
import { Text, View } from "react-native";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import { TaskRow } from "@/components/ui/task-row";
import { featureTeam, teamRole } from "@/components/feature/feature-team";
import { PersonSummaryCard, PersonTaskCard } from "@/components/feature/person-work";
import {
  DetailPage,
  PageLoading,
  PageNotFound,
  useGoBack,
  usePageSize,
} from "@/components/ui/detail-page";
import { PageHeader } from "@/components/ui/page-header";
import { Panel, SectionTitle } from "@/components/ui/panel";
import { colors, fonts, usePageColors } from "@/components/ui/theme";
import { useNow } from "@/lib/use-now";

/**
 * One person's work on one feature (from the feature page's Who's on it): their tasks there with
 * status, deadline, progress and what each must deliver, and the code tasks they review. Daily
 * logs (Phase 5) and submitted proof (Phase 6) join this page when those phases are built.
 */
export default function FeaturePersonScreen(): JSX.Element {
  const { featureId, userId } = useLocalSearchParams<{
    featureId: Id<"features">;
    userId: Id<"users">;
  }>();
  const data = useQuery(api.features.get, { featureId });
  const router = useRouter();
  const goBack = useGoBack();
  const now = useNow();
  const { s, content } = usePageSize();
  const c = usePageColors();

  if (data === undefined) {
    return (
      <DetailPage title="Person" content={content}>
        <PageLoading />
      </DetailPage>
    );
  }
  const member =
    data === null ? undefined : featureTeam(data.tasks).find((m) => m.user._id === userId);
  if (data === null || member === undefined) {
    return (
      <DetailPage title="Person" content={content}>
        <PageNotFound
          s={s}
          message={
            data === null
              ? "This feature doesn't exist."
              : "This person has no tasks on this feature any more."
          }
          onBack={goBack}
        />
      </DetailPage>
    );
  }

  const { feature } = data;
  const { user, owns, reviews } = member;
  const openTask = (taskId: string) =>
    router.push({ pathname: "/tasks/[taskId]", params: { taskId } });

  return (
    <DetailPage title={user.name} content={content}>
      <View style={{ gap: 22 * s }}>
        <PageHeader
          s={s}
          title={user.name}
          subtitle={[
            user.title !== "" ? user.title : null,
            `${teamRole(member)} on ${feature.title}`,
            user.isActive ? null : "deactivated",
          ]
            .filter((part) => part !== null)
            .join(" · ")}
          onSubtitlePress={() =>
            router.push({ pathname: "/features/[featureId]", params: { featureId: feature._id } })
          }
          subtitleHint="Opens the feature"
          onBack={goBack}
        />

        <PersonSummaryCard
          s={s}
          member={member}
          color={owns.length > 0 ? colors.peach : colors.sky}
        />

        {owns.length > 0 ? (
          <View style={{ gap: 12 * s }}>
            <SectionTitle s={s} title="Their tasks" count={owns.length} />
            {owns.map((task) => (
              <PersonTaskCard
                key={task._id}
                s={s}
                task={task}
                now={now}
                onPress={() => openTask(task._id)}
              />
            ))}
          </View>
        ) : null}

        {reviews.length > 0 ? (
          <View style={{ gap: 12 * s }}>
            <SectionTitle s={s} title="Reviewing" count={reviews.length} />
            {reviews.map((task) => (
              <TaskRow
                key={task._id}
                task={task}
                now={now}
                showProgress
                onPress={() => openTask(task._id)}
              />
            ))}
          </View>
        ) : null}

        <Panel s={s} title="Logs and proof">
          <Text
            style={{
              fontFamily: fonts.medium,
              fontSize: 14,
              lineHeight: 20,
              color: c.muted,
            }}
          >
            What {user.name.split(" ")[0]} logs each day (Phase 5) and the proof submitted with each
            task (Phase 6) will show here.
          </Text>
        </Panel>
      </View>
    </DetailPage>
  );
}
