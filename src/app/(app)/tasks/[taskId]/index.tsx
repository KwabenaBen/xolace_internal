import { useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Alert, Button, Card, Input, Label, Separator, TextField, Typography } from "heroui-native";
import { useState, type JSX } from "react";
import { Pressable, View } from "react-native";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { formatDeadline } from "@convex/lib/dates";
import type { UserSummary } from "@convex/lib/views";

import { LoadingScreen } from "@/components/loading-screen";
import { PriorityText, StatusChip } from "@/components/planning/badges";
import { DeadlineText } from "@/components/planning/deadline-text";
import { DetailRow } from "@/components/planning/detail";
import { FormError } from "@/components/planning/form-error";
import { NotFound } from "@/components/planning/not-found";
import { Screen } from "@/components/screen";
import { TASK_KIND_LABELS } from "@/constants/labels";
import { getErrorMessage } from "@/lib/errors";
import { useSignedInUser } from "@/lib/use-current-user";

function person(user: UserSummary | null, fallback: string): string {
  if (user === null) return fallback;
  return `${user.name} · ${user.title}${user.isActive ? "" : " (deactivated)"}`;
}

export default function TaskScreen(): JSX.Element {
  const { taskId } = useLocalSearchParams<{ taskId: Id<"tasks"> }>();
  const data = useQuery(api.tasks.get, { taskId });
  const user = useSignedInUser();
  const router = useRouter();
  const isAdmin = user.role === "admin";

  if (data === undefined) return <LoadingScreen />;
  if (data === null) return <NotFound what="task" />;
  const { task, feature } = data;
  const isProposal = task.status === "proposed";
  const deadlineMoved =
    task.originalDeadline !== undefined &&
    task.deadline !== undefined &&
    task.originalDeadline !== task.deadline;

  return (
    <Screen withHeader>
      <Stack.Screen options={{ title: isProposal ? "Proposal" : "Task" }} />

      <View className="gap-2">
        <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
          <StatusChip status={task.status} />
          <PriorityText priority={task.priority} />
          <Typography type="body-xs" color="muted">
            {TASK_KIND_LABELS[task.kind]}
          </Typography>
        </View>
        <Typography.Heading type="h3">{task.title}</Typography.Heading>
        <Pressable
          accessibilityRole="link"
          onPress={() =>
            router.push({ pathname: "/features/[featureId]", params: { featureId: feature._id } })
          }
          className="self-start active:opacity-60"
        >
          <Typography type="body-sm" className="text-link">
            {feature.title} ›
          </Typography>
        </Pressable>
      </View>

      {task.status === "declined" ? (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Proposal declined</Alert.Title>
            <Alert.Description>{task.declineReason ?? "No reason given."}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      {isProposal && !isAdmin ? (
        <Typography type="body-sm" color="muted">
          Waiting for the admin to approve it. Owner, deadline and final acceptance criteria are set
          on approval.
        </Typography>
      ) : null}

      <Card>
        <Card.Body className="gap-4">
          {!isProposal && task.status !== "declined" ? (
            <>
              <DetailRow label="Owner">{person(task.owner, "Unassigned")}</DetailRow>
              {task.kind === "code" ? (
                <DetailRow label="Peer reviewer">{person(task.peerReviewer, "Not set")}</DetailRow>
              ) : null}
              <DetailRow label="Deadline">
                <View className="gap-0.5">
                  <DeadlineText deadline={task.deadline} status={task.status} />
                  {deadlineMoved && task.originalDeadline !== undefined ? (
                    <Typography type="body-xs" color="muted">
                      Originally {formatDeadline(task.originalDeadline)}
                    </Typography>
                  ) : null}
                </View>
              </DetailRow>
            </>
          ) : null}
          {task.proposer !== null ? (
            <DetailRow label="Proposed by">{person(task.proposer, "Someone")}</DetailRow>
          ) : null}
          {task.description !== "" ? (
            <DetailRow label="Description">{task.description}</DetailRow>
          ) : null}
          <Separator />
          <DetailRow label={isProposal ? "Suggested acceptance criteria" : "Acceptance criteria"}>
            {task.acceptanceCriteria.length === 0 ? (
              <Typography type="body-sm" color="muted">
                None yet.
              </Typography>
            ) : (
              <View className="gap-2">
                {task.acceptanceCriteria.map((criterion, index) => (
                  <View key={index} className="flex-row gap-2">
                    <Typography type="body" color="muted" className="w-5 text-right">
                      {index + 1}.
                    </Typography>
                    <Typography type="body" className="flex-1">
                      {criterion}
                    </Typography>
                  </View>
                ))}
              </View>
            )}
          </DetailRow>
        </Card.Body>
      </Card>

      {isAdmin && isProposal ? <ProposalActions taskId={task._id} /> : null}
      {isAdmin && !isProposal && task.status !== "declined" ? (
        <Button
          variant="secondary"
          onPress={() =>
            router.push({ pathname: "/tasks/[taskId]/edit", params: { taskId: task._id } })
          }
        >
          Edit task
        </Button>
      ) : null}
    </Screen>
  );
}

/** Admin: approve (opens the plan form) or decline with a reason. */
function ProposalActions({ taskId }: { taskId: Id<"tasks"> }): JSX.Element {
  const router = useRouter();
  const declineProposal = useMutation(api.tasks.declineProposal);
  const [isDeclining, setIsDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function decline() {
    if (reason.trim() === "") {
      setError("Give a reason so the proposer knows why.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await declineProposal({ taskId, reason });
      setIsDeclining(false);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isDeclining) {
    return (
      <Card>
        <Card.Body className="gap-4">
          <FormError message={error} />
          <TextField isRequired>
            <Label>Why are you declining it?</Label>
            <Input
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. Out of scope for v1"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </TextField>
          <View className="flex-row gap-3">
            <Button variant="secondary" className="flex-1" onPress={() => setIsDeclining(false)}>
              Cancel
            </Button>
            <Button variant="danger" className="flex-1" onPress={decline} isDisabled={isSubmitting}>
              {isSubmitting ? "Declining…" : "Decline"}
            </Button>
          </View>
        </Card.Body>
      </Card>
    );
  }

  return (
    <View className="flex-row gap-3">
      <Button
        className="flex-1"
        onPress={() => router.push({ pathname: "/tasks/[taskId]/edit", params: { taskId } })}
      >
        Review & approve
      </Button>
      <Button variant="danger-soft" className="flex-1" onPress={() => setIsDeclining(true)}>
        Decline
      </Button>
    </View>
  );
}
