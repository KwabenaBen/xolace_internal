import { useMutation } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import type { JSX } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import { EMPTY_TASK, TaskForm, toTaskPlan } from "@/components/planning/task-form";
import { useSignedInUser } from "@/lib/use-current-user";

/** Admins create a live task; members propose one for the admin to approve. */
export default function NewTaskScreen(): JSX.Element {
  const { featureId } = useLocalSearchParams<{ featureId?: Id<"features"> }>();
  const user = useSignedInUser();
  const isAdmin = user.role === "admin";
  const createTask = useMutation(api.tasks.create);
  const proposeTask = useMutation(api.tasks.propose);
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ title: isAdmin ? "New task" : "Propose a task" }} />
      <TaskForm
        mode={isAdmin ? "create" : "propose"}
        initial={{ ...EMPTY_TASK, featureId: featureId ?? null }}
        lockFeature={featureId !== undefined}
        onSubmit={async (values) => {
          if (values.featureId === null) return;
          const taskId = isAdmin
            ? await createTask({ featureId: values.featureId, ...toTaskPlan(values) })
            : await proposeTask({
                featureId: values.featureId,
                title: values.title,
                description: values.description,
                kind: values.kind,
                acceptanceCriteria: values.acceptanceCriteria,
                priority: values.priority,
              });
          router.replace({ pathname: "/tasks/[taskId]", params: { taskId } });
        }}
      />
    </>
  );
}
