import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, type JSX } from "react";
import { Text, View } from "react-native";

import type { Id } from "@convex/_generated/dataModel";
import { isPlanLocked } from "@convex/lib/validators";

import type { UserSummary } from "@convex/lib/views";

import { colors, fonts, usePageColors } from "@/components/ui/theme";
import { CountdownCard } from "@/components/task/countdown-card";
import {
  DetailPage,
  PageLoading,
  PageNotFound,
  useGoBack,
  usePageSize,
} from "@/components/ui/detail-page";
import { HoloCard } from "@/components/task/holo-card";
import { PeopleCards, type PersonCard } from "@/components/task/people-cards";
import { decidedBy } from "@/components/task/deciders";
import { ExtensionPanel } from "@/components/task/extension-panel";
import { ExtensionSheet } from "@/components/task/extension-sheet";
import { OwnerActions, TaskActions } from "@/components/task/task-actions";
import { TaskHistory } from "@/components/task/task-history";
import { UpdateSheet } from "@/components/task/update-sheet";
import {
  lockedNote,
  nextReviewStep,
  reviewBlocker,
  taskFacts,
  useTaskData,
} from "@/components/task/use-task-state";
import { ReviewPanel } from "@/components/task/review-panel";
import { ReviewSheet } from "@/components/task/review-sheet";
import { verifiedBy } from "@/components/task/verifiers";
import { WebTaskPanel } from "@/components/web/task/web-task";
import { PageHeader } from "@/components/ui/page-header";
import { CriteriaCard, DescriptionCard, TaskBanner } from "@/components/task/task-panels";
import { STATUS_WORDS } from "@/components/task/task-theme";
import { TASK_KIND_LABELS, TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/constants/labels";
import { useSignedInUser } from "@/lib/use-current-user";
import { useIsDesktop } from "@/lib/use-desktop";
import { useNow } from "@/lib/use-now";

/**
 * A task, in the app's black/off-white style: back button, its title (and a link to its feature), a
 * holographic card spelling its status (after Native Cook's "Holo Cash Card"), a lavender
 * countdown to the task's own deadline (with the feature's beside it), its description, the people
 * on it as pastel cards (after the team's fitness-app reference), its acceptance criteria, the
 * admin's pill buttons, and its history with comments. While it's in the owner's hands, the
 * owner posts updates (status, progress, a note) and asks for more time from buttons under the
 * countdown; a request waiting for a decision shows above it, where the decider answers it.
 * Black or off-white, following the phone's theme. On a wide browser window the task opens as the
 * website layout's side panel instead (src/components/web/task/).
 */
export default function TaskScreen(): JSX.Element {
  const { taskId } = useLocalSearchParams<{ taskId: Id<"tasks"> }>();
  return useIsDesktop() ? <WebTaskPanel taskId={taskId} /> : <PhoneTask taskId={taskId} />;
}

/** The phone's task page (described above the default export). */
function PhoneTask({ taskId }: { taskId: Id<"tasks"> }): JSX.Element {
  const { data, extensions, reviews, windowHours } = useTaskData(taskId);
  const user = useSignedInUser();
  const router = useRouter();
  const goBack = useGoBack();
  const { s, content } = usePageSize();
  const isAdmin = user.role === "admin";
  const c = usePageColors();
  const now = useNow();
  const [open, setOpen] = useState<"update" | "extend" | "peer" | "submit" | null>(null);

  let body: JSX.Element;
  if (data === undefined) {
    body = <PageLoading />;
  } else if (data === null) {
    body = <PageNotFound s={s} message="This task doesn't exist." onBack={goBack} />;
  } else {
    const { task, feature } = data;
    const {
      isProposal,
      isDeclined,
      isLive,
      canUpdate,
      pending,
      hasPending,
      cantAsk,
      approveBlock,
    } = taskFacts(task, feature, extensions, user._id);
    const step = nextReviewStep(reviews);
    // No review button right now (blocked, no reviewer or verifier…): say why in its place.
    const cantSubmit = reviewBlocker(task, reviews, canUpdate);
    const edit = () =>
      router.push({ pathname: "/tasks/[taskId]/edit", params: { taskId: task._id } });
    // Owner and reviewer cards open that person's work on this feature.
    const openPerson = (person: UserSummary | null) =>
      person === null
        ? undefined
        : () =>
            router.push({
              pathname: "/features/[featureId]/people/[userId]",
              params: { featureId: feature._id, userId: person._id },
            });

    const people: PersonCard[] = [];
    if (isLive) {
      people.push({
        role: "Owner",
        user: task.owner,
        fallback: "Unassigned",
        color: colors.peach,
        tag: TASK_PRIORITY_LABELS[task.priority],
        onPress: openPerson(task.owner),
        hint: "Shows their work on this feature",
      });
      if (task.kind === "code") {
        people.push({
          role: "Peer reviewer",
          user: task.peerReviewer,
          fallback: "Not set",
          color: colors.sky,
          tag: TASK_KIND_LABELS.code,
          onPress: openPerson(task.peerReviewer),
          hint: "Shows their work on this feature",
        });
      }
    }
    if (task.proposer !== null) {
      people.push({
        role: "Proposed by",
        user: task.proposer,
        fallback: "Someone",
        color: colors.pink,
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
          onSubtitlePress={() =>
            router.push({ pathname: "/features/[featureId]", params: { featureId: feature._id } })
          }
          subtitleHint="Opens the feature"
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

        {isLive && task.countsAsLate ? (
          <TaskBanner
            s={s}
            tone="late"
            title="Counts as late"
            body="An extension was asked for close to its deadline, or wasn't a scope change. It stays on the record."
          />
        ) : null}
        {isLive && extensions !== undefined && pending !== undefined ? (
          <ExtensionPanel
            key={pending._id}
            s={s}
            data={extensions}
            pending={pending}
            featureDeadline={feature.deadline}
            windowHours={windowHours}
            now={now}
            myId={user._id}
            alreadyLate={task.countsAsLate}
            approveBlock={approveBlock}
          />
        ) : null}
        {isLive && reviews !== undefined ? (
          <ReviewPanel
            key={reviews.pending?._id ?? "none"}
            s={s}
            task={task}
            reviews={reviews}
            now={now}
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
            alsoDue={{ label: "feature", at: feature.deadline }}
            noDeadlineNote="Set when an admin approves it"
          />
        ) : null}
        {canUpdate ? (
          <View style={{ gap: 10 }}>
            <OwnerActions
              canExtend={!hasPending && cantAsk === null && task.deadline !== undefined}
              onUpdate={() => setOpen("update")}
              onExtend={() => setOpen("extend")}
              review={
                step === null
                  ? null
                  : {
                      label: step === "peer" ? "Ask for a peer review" : "Submit for verification",
                      onPress: () => setOpen(step),
                    }
              }
            />
            {!hasPending && cantAsk !== null ? (
              <Text
                style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: c.muted }}
              >
                {cantAsk}
              </Text>
            ) : null}
            {cantSubmit !== null ? (
              <Text
                style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: c.muted }}
              >
                {cantSubmit}
              </Text>
            ) : null}
          </View>
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
          lockedNote={isPlanLocked(task.status) ? lockedNote(task.status) : null}
          onEdit={edit}
        />
        <TaskHistory s={s} taskId={task._id} canComment={!isDeclined} />

        {open === "update" ? <UpdateSheet task={task} onClose={() => setOpen(null)} /> : null}
        {open === "peer" || open === "submit" ? (
          <ReviewSheet
            mode={open}
            taskId={task._id}
            reviewerName={task.peerReviewer?.name}
            verifierWords={reviews !== undefined ? verifiedBy(reviews.verifier) : undefined}
            onClose={() => setOpen(null)}
          />
        ) : null}
        {open === "extend" && task.deadline !== undefined ? (
          <ExtensionSheet
            taskId={task._id}
            deadline={task.deadline}
            featureDeadline={feature.deadline}
            windowHours={windowHours}
            decidedBy={
              extensions !== undefined ? decidedBy(extensions.decider) : "An admin decides."
            }
            alreadyLate={task.countsAsLate}
            onClose={() => setOpen(null)}
          />
        ) : null}
      </View>
    );
  }

  return (
    <DetailPage title={data?.task.status === "proposed" ? "Proposal" : "Task"} content={content}>
      {body}
    </DetailPage>
  );
}
