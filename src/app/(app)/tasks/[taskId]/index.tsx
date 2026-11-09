import { useQuery } from "convex/react";
import { Stack, useIsFocused, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import type { JSX } from "react";
import { ActivityIndicator, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import { fonts, MAX_BOARD_WIDTH, REFERENCE_WIDTH } from "@/components/board/board-theme";
import { CountdownCard } from "@/components/task/countdown-card";
import { HoloCard } from "@/components/task/holo-card";
import { PeopleCards, type PersonCard } from "@/components/task/people-cards";
import { TaskActions } from "@/components/task/task-actions";
import { shortDay } from "@/components/task/task-dates";
import { PageHeader, RoundButton } from "@/components/task/task-header";
import { CriteriaCard, DescriptionCard, TaskBanner } from "@/components/task/task-panels";
import { taskSymbols } from "@/components/task/task-symbols";
import { STATUS_WORDS, taskColors } from "@/components/task/task-theme";
import { TASK_KIND_LABELS, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/constants/labels";
import { useSignedInUser } from "@/lib/use-current-user";

const GUTTER = 18;

/**
 * A task, in the Board's black style: back button, its title (and the feature it's part of), a
 * holographic card spelling its status (after Native Cook's "Holo Cash Card"), a lavender
 * countdown to the task's own deadline (with the feature's beside it), its description, the people
 * on it as pastel cards (after the team's fitness-app reference), its acceptance criteria, and the
 * admin's pill buttons. Always black, whatever the theme.
 */
export default function TaskScreen(): JSX.Element {
  const { taskId } = useLocalSearchParams<{ taskId: Id<"tasks"> }>();
  const data = useQuery(api.tasks.get, { taskId });
  const user = useSignedInUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth, MAX_BOARD_WIDTH);
  const s = width / REFERENCE_WIDTH;
  const content = width - GUTTER * 2;
  const isAdmin = user.role === "admin";

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/"));

  let body: JSX.Element;
  if (data === undefined) {
    body = (
      <View style={{ paddingTop: 80, alignItems: "center" }}>
        <ActivityIndicator color={taskColors.white} />
      </View>
    );
  } else if (data === null) {
    body = (
      <View style={{ gap: 24 }}>
        <View style={{ flexDirection: "row" }}>
          <RoundButton symbol={taskSymbols.back} label="Back" onPress={goBack} s={s} />
        </View>
        <Text style={{ fontFamily: fonts.medium, fontSize: 15, color: taskColors.secondary }}>
          This task doesn&apos;t exist.
        </Text>
      </View>
    );
  } else {
    const { task, feature } = data;
    const isProposal = task.status === "proposed";
    const isDeclined = task.status === "declined";
    const isLive = !isProposal && !isDeclined;
    const edit = () =>
      router.push({ pathname: "/tasks/[taskId]/edit", params: { taskId: task._id } });

    const people: PersonCard[] = [];
    if (isLive) {
      people.push({
        role: "Owner",
        user: task.owner,
        fallback: "Unassigned",
        color: taskColors.peach,
        tag: TASK_PRIORITY_LABELS[task.priority],
      });
      if (task.kind === "code") {
        people.push({
          role: "Peer reviewer",
          user: task.peerReviewer,
          fallback: "Not set",
          color: taskColors.sky,
          tag: TASK_KIND_LABELS.code,
        });
      }
    }
    if (task.proposer !== null) {
      people.push({
        role: "Proposed by",
        user: task.proposer,
        fallback: "Someone",
        color: taskColors.pink,
      });
    }

    const holder = isLive
      ? ["OWNED BY", task.owner?.name ?? "Unassigned"]
      : ["PROPOSED BY", task.proposer?.name ?? "Someone"];

    body = (
      <View style={{ gap: 22 * s }}>
        <PageHeader
          s={s}
          title={task.title}
          subtitle={`${isLive ? "Part of" : "Proposed for"} ${feature.title}`}
          onBack={goBack}
        />

        <HoloCard
          width={content}
          word={STATUS_WORDS[task.status]}
          footer={[holder[0], holder[1].toUpperCase()]}
          corner={TASK_KIND_LABELS[task.kind].toUpperCase()}
          glow={task.status === "verified" ? 1 : 0}
          accessibilityLabel={`Status: ${TASK_STATUS_LABELS[task.status]}. ${TASK_KIND_LABELS[task.kind]} task.`}
        />

        {isDeclined ? (
          <TaskBanner
            s={s}
            tone="declined"
            title="Proposal declined"
            body={task.declineReason ?? "No reason given."}
          />
        ) : null}
        {isProposal ? (
          <TaskBanner
            s={s}
            tone="waiting"
            title={isAdmin ? "Waiting for your review" : "Waiting for an admin"}
            body={
              isAdmin
                ? "Approve it to set the owner, deadline and final acceptance criteria, or decline it with a reason."
                : "The owner, deadline and final acceptance criteria are set when an admin approves it."
            }
          />
        ) : null}

        {!isDeclined ? (
          <CountdownCard
            s={s}
            subject="Task"
            deadline={task.deadline}
            originalDeadline={task.originalDeadline}
            finished={
              task.status === "verified" ? { verb: "Verified", at: task.verifiedAt } : undefined
            }
            tag={{
              text: TASK_PRIORITY_LABELS[task.priority].toUpperCase(),
              spoken: `Priority ${TASK_PRIORITY_LABELS[task.priority]}`,
            }}
            urgent={task.priority === "urgent"}
            progress={task.progress}
            dueNote={`feature due ${shortDay(feature.deadline)}`}
            noDeadlineNote="Set when an admin approves it"
          />
        ) : null}
        {task.description !== "" ? <DescriptionCard s={s} text={task.description} /> : null}
        {people.length > 0 ? <PeopleCards width={content} s={s} people={people} /> : null}
        <CriteriaCard
          s={s}
          criteria={task.acceptanceCriteria}
          suggested={!isLive}
          verified={task.status === "verified"}
        />
        <TaskActions
          taskId={task._id}
          isAdmin={isAdmin}
          isProposal={isProposal}
          isDeclined={isDeclined}
          onEdit={edit}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: taskColors.page }}>
      <Stack.Screen options={{ title: data?.task.status === "proposed" ? "Proposal" : "Task" }} />
      {isFocused ? <StatusBar style="light" /> : null}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 40,
          alignItems: "center",
        }}
      >
        <View style={{ width: content }}>{body}</View>
      </ScrollView>
    </View>
  );
}
