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
import { ruleValue } from "@/components/team-rules/rules";
import { useSignedInUser } from "@/lib/use-current-user";
import { useNow } from "@/lib/use-now";

/** Admin: edit a live task, or review a proposal (approving it completes its plan). */
export default function EditTaskScreen(): JSX.Element {
  const { taskId } = useLocalSearchParams<{ taskId: Id<"tasks"> }>();
  const data = useQuery(api.tasks.get, { taskId });
  const users = useQuery(api.users.list);
  const rules = useQuery(api.settings.list);
  const now = useNow();
  const updateTask = useMutation(api.tasks.update);
  const approveProposal = useMutation(api.tasks.approveProposal);
  const router = useRouter();
  const user = useSignedInUser();

  if (data === undefined || users === undefined) return <LoadingScreen />;
  if (data === null) return <NotFound what="task" />;
  const { task } = data;
  const isProposal = task.status === "proposed";
  if (isPlanLocked(task.status)) {
    return (
      <Screen withHeader dialogTitle="Edit task">
        <Typography type="body" color="muted">
          This task is in review, submitted or verified, so its plan is locked. It can change again
          once it&apos;s sent back to its owner.
        </Typography>
      </Screen>
    );
  }
  // An admin's task moves only through a request for more time, decided by the admin task
  // reviewer (the server refuses too): nobody approves their own work.
  const ownerIsAdmin = users.some((u) => u._id === task.ownerId && u.role === "admin");
  const deadlineLockedReason =
    isProposal || !ownerIsAdmin
      ? undefined
      : task.ownerId === user._id
        ? "You own this task, so its deadline moves through a request for more time, decided by the admin task reviewer."
        : "An admin owns this task, so its deadline moves through their request for more time, decided by the admin task reviewer.";
  // Work has begun (convex/tasks.ts → hasStarted): a later deadline is judged by the late rule.
  const started =
    task.status !== "todo" ||
    task.progress > 0 ||
    (task.deadline !== undefined && task.deadline <= now);
  const windowValue = ruleValue(rules, "extensionLateWindowHours");
  const deadlineMove =
    !isProposal && started && task.deadline !== undefined
      ? {
          current: task.deadline,
          windowHours: typeof windowValue === "number" ? windowValue : 24,
          alreadyLate: task.countsAsLate,
        }
      : undefined;

  return (
    <AdminOnly>
      <Stack.Screen options={{ title: isProposal ? "Approve proposal" : "Edit task" }} />
      <TaskForm
        mode={isProposal ? "approve" : "edit"}
        initial={taskToFormValues(task)}
        lockFeature
        deadlineLockedReason={deadlineLockedReason}
        deadlineMove={deadlineMove}
        onSubmit={async (values, deadlineChangeType) => {
          const plan = toTaskPlan(values);
          if (isProposal) await approveProposal({ taskId, ...plan });
          else await updateTask({ taskId, ...plan, deadlineChangeType });
          // Opened straight from a link or a web refresh, there may be nothing to go back to.
          if (router.canGoBack()) router.back();
          else router.replace({ pathname: "/tasks/[taskId]", params: { taskId } });
        }}
      />
    </AdminOnly>
  );
}
