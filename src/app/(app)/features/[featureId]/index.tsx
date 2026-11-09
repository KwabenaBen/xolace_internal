import { useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { JSX } from "react";
import { Text, View } from "react-native";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import { PillButton, PillRow } from "@/components/ui/pill-button";
import { featureProgress, plural } from "@/components/board/board-stats";
import { TaskRow } from "@/components/ui/task-row";
import { featureTeam, teamRole } from "@/components/feature/feature-team";
import { CountdownCard } from "@/components/task/countdown-card";
import {
  DetailPage,
  PageLoading,
  PageNotFound,
  useGoBack,
  usePageSize,
} from "@/components/ui/detail-page";
import { HoloCard } from "@/components/task/holo-card";
import { PeopleCards } from "@/components/task/people-cards";
import { PageHeader } from "@/components/ui/page-header";
import { SectionTitle } from "@/components/ui/panel";
import { DescriptionCard } from "@/components/task/task-panels";
import { FEATURE_STATUS_WORDS } from "@/components/task/task-theme";
import { FEATURE_STATUS_LABELS } from "@/constants/labels";
import { useSignedInUser } from "@/lib/use-current-user";
import { colors, fonts, usePageColors } from "@/components/ui/theme";
import { useNow } from "@/lib/use-now";

/**
 * A feature, in the app's black/off-white style (the Board's "next up" tile and feature cards open it):
 * back button, the feature's title, a holographic card spelling its stage, a lavender countdown to
 * its deadline with its progress, the description and expected result, Who's on it (tap a person
 * for their work on it), every task with its progress, proposals waiting, and pill buttons.
 */
export default function FeatureScreen(): JSX.Element {
  const { featureId } = useLocalSearchParams<{ featureId: Id<"features"> }>();
  const data = useQuery(api.features.get, { featureId });
  const user = useSignedInUser();
  const router = useRouter();
  const goBack = useGoBack();
  const now = useNow();
  const { s, content } = usePageSize();
  const c = usePageColors();
  const isAdmin = user.role === "admin";

  if (data === undefined) {
    return (
      <DetailPage title="Feature" content={content}>
        <PageLoading />
      </DetailPage>
    );
  }
  if (data === null) {
    return (
      <DetailPage title="Feature" content={content}>
        <PageNotFound s={s} message="This feature doesn't exist." onBack={goBack} />
      </DetailPage>
    );
  }

  const { feature, createdBy, tasks, proposals } = data;
  const progress = featureProgress(tasks);
  const team = featureTeam(tasks);
  const canAddWork = feature.status !== "shipped";
  const planner = createdBy?.name ?? "an admin";
  const openTask = (taskId: string) =>
    router.push({ pathname: "/tasks/[taskId]", params: { taskId } });
  const newTask = () => router.push({ pathname: "/tasks/new", params: { featureId: feature._id } });
  const edit = () =>
    router.push({ pathname: "/features/[featureId]/edit", params: { featureId: feature._id } });

  return (
    <DetailPage title={feature.title} content={content}>
      <View style={{ gap: 22 * s }}>
        <PageHeader
          s={s}
          title={feature.title}
          subtitle={
            feature.sourceNote !== ""
              ? `Agreed at ${feature.sourceNote} · planned by ${planner}`
              : `Planned by ${planner}`
          }
          onBack={goBack}
        />

        <HoloCard
          width={content}
          word={FEATURE_STATUS_WORDS[feature.status]}
          footer={[plural(progress.total, "TASK", "TASKS"), `${progress.verified} VERIFIED`]}
          corner="FEATURE"
          glow={feature.status === "shipped" ? 1 : 0}
          accessibilityLabel={`Stage: ${FEATURE_STATUS_LABELS[feature.status]}. ${plural(progress.total, "task")}, ${progress.verified} verified.`}
        />

        <CountdownCard
          s={s}
          subject="Feature"
          deadline={feature.deadline}
          finished={feature.status === "shipped" ? { verb: "Shipped" } : undefined}
          progress={progress.percent}
          progressNote={
            progress.total === 0
              ? "No tasks yet"
              : `${progress.verified} of ${plural(progress.total, "task")} verified`
          }
        />

        {feature.description !== "" ? <DescriptionCard s={s} text={feature.description} /> : null}
        {feature.expectedResult !== "" ? (
          <DescriptionCard s={s} title="Expected result" text={feature.expectedResult} />
        ) : null}

        {team.length > 0 ? (
          <PeopleCards
            width={content}
            s={s}
            people={team.map((member) => ({
              id: member.user._id,
              role: teamRole(member),
              user: member.user,
              fallback: member.user.name,
              color: member.owns.length > 0 ? colors.peach : colors.sky,
              tag:
                member.owns.length > 0
                  ? plural(member.owns.length, "task")
                  : `Reviews ${member.reviews.length}`,
              progress: member.owns.length > 0 ? member.progress.percent : undefined,
              hint: "Shows their work on this feature",
              onPress: () =>
                router.push({
                  pathname: "/features/[featureId]/people/[userId]",
                  params: { featureId: feature._id, userId: member.user._id },
                }),
            }))}
          />
        ) : null}

        <View style={{ gap: 12 * s }}>
          <SectionTitle s={s} title="Tasks" count={tasks.length} />
          {tasks.length === 0 ? (
            <Text
              style={{
                fontFamily: fonts.medium,
                fontSize: 15,
                color: c.muted,
                paddingHorizontal: 4,
              }}
            >
              No tasks yet.
            </Text>
          ) : (
            tasks.map((task) => (
              <TaskRow
                key={task._id}
                task={task}
                now={now}
                showProgress
                onPress={() => openTask(task._id)}
              />
            ))
          )}
        </View>

        {proposals.length > 0 ? (
          <View style={{ gap: 12 * s }}>
            <SectionTitle s={s} title="Waiting for approval" count={proposals.length} />
            {proposals.map((task) => (
              <TaskRow key={task._id} task={task} now={now} onPress={() => openTask(task._id)} />
            ))}
          </View>
        ) : null}

        {isAdmin ? (
          canAddWork ? (
            <PillRow>
              <PillButton label="Edit feature" variant="secondary" onPress={edit} />
              <PillButton label="Add task" onPress={newTask} />
            </PillRow>
          ) : (
            <PillRow>
              <PillButton label="Edit feature" variant="secondary" onPress={edit} />
            </PillRow>
          )
        ) : canAddWork ? (
          <PillRow>
            <PillButton label="Propose a task" onPress={newTask} />
          </PillRow>
        ) : null}
      </View>
    </DetailPage>
  );
}
