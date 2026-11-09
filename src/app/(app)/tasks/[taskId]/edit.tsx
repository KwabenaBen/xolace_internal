import { useMutation, useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import type { JSX } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import { LoadingScreen } from "@/components/loading-screen";
import { AdminOnly } from "@/components/planning/admin-only";
import { NotFound } from "@/components/planning/not-found";
import { TaskForm, taskToFormValues, toTaskPlan } from "@/components/planning/task-form";

/** Admin: edit a live task, or review a proposal (approving it completes its plan). */
export default function EditTaskScreen(): JSX.Element {
  const { taskId } = useLocalSearchParams<{ taskId: Id<"tasks"> }>();
  const data = useQuery(api.tasks.get, { taskId });
  const updateTask = useMutation(api.tasks.update);
  const approveProposal = useMutation(api.tasks.approveProposal);
  const router = useRouter();

  if (data === undefined) return <LoadingScreen />;
  if (data === null) return <NotFound what="task" />;
  const { task } = data;
  const isProposal = task.status === "proposed";

  return (
    <AdminOnly>
      <Stack.Screen options={{ title: isProposal ? "Approve proposal" : "Edit task" }} />
      <TaskForm
        mode={isProposal ? "approve" : "edit"}
        initial={taskToFormValues(task)}
        lockFeature
        onSubmit={async (values) => {
          const plan = toTaskPlan(values);
          if (isProposal) await approveProposal({ taskId, ...plan });
          else await updateTask({ taskId, ...plan });
          router.back();
        }}
      />
    </AdminOnly>
  );
}
