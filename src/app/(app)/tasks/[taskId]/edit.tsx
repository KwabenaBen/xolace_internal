import { useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Typography } from "heroui-native";
import type { JSX } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { isPlanLocked } from "@convex/lib/validators";

import { LoadingScreen } from "@/components/loading-screen";
import { AdminOnly } from "@/components/planning/admin-only";
import { NotFound } from "@/components/planning/not-found";
import { TaskForm, taskToFormValues, toTaskPlan } from "@/components/planning/task-form";
import { Screen } from "@/components/screen";
import { useSignedInUser } from "@/lib/use-current-user";

/** Admin: edit a live task, or review a proposal (approving it completes its plan). */
export default function EditTaskScreen(): JSX.Element {
  const { taskId } = useLocalSearchParams<{ taskId: Id<"tasks"> }>();
  const data = useQuery(api.tasks.get, { taskId });
  const updateTask = useMutation(api.tasks.update);
  const approveProposal = useMutation(api.tasks.approveProposal);
  const router = useRouter();
  const user = useSignedInUser();

  if (data === undefined) return <LoadingScreen />;
  if (data === null) return <NotFound what="task" />;
  const { task } = data;
  const isProposal = task.status === "proposed";
  if (isPlanLocked(task.status)) {
    return (
      <Screen withHeader>
        <Typography type="body" color="muted">
          This task is in review, submitted or verified, so its plan is locked. It can change again
          once it&apos;s sent back to its owner.
        </Typography>
      </Screen>
    );
  }
  // Nobody moves their own deadline (the server refuses too): another admin, or an extension.
  const deadlineLockedReason =
    !isProposal && task.ownerId === user._id
      ? "You own this task, so you can't move its deadline. Another admin can, or request an extension."
      : undefined;

  return (
    <AdminOnly>
      <Stack.Screen options={{ title: isProposal ? "Approve proposal" : "Edit task" }} />
      <TaskForm
        mode={isProposal ? "approve" : "edit"}
        initial={taskToFormValues(task)}
        lockFeature
        deadlineLockedReason={deadlineLockedReason}
        onSubmit={async (values) => {
          const plan = toTaskPlan(values);
          if (isProposal) await approveProposal({ taskId, ...plan });
          else await updateTask({ taskId, ...plan });
          // Opened straight from a link or a web refresh, there may be nothing to go back to.
          if (router.canGoBack()) router.back();
          else router.replace({ pathname: "/tasks/[taskId]", params: { taskId } });
        }}
      />
    </AdminOnly>
  );
}
