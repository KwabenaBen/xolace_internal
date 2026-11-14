import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Button, Spinner } from "heroui-native";
import type { JSX } from "react";
import { Text, View } from "react-native";

import { api } from "@convex/_generated/api";

import { Screen } from "@/components/screen";
import { ExtensionRow } from "@/components/task/extension-row";
import { SectionTitle } from "@/components/ui/panel";
import { TaskRow } from "@/components/ui/task-row";
import { fonts, usePageColors } from "@/components/ui/theme";
import { useSignedInUser } from "@/lib/use-current-user";
import { useNow } from "@/lib/use-now";

/**
 * Your work: reviews waiting on you (code to peer-review, submissions to verify), requests for
 * more time waiting on your decision (an admin's, or the admin task reviewer's for an admin's own
 * task), what you own, soonest deadline first, and what you've proposed.
 */
export default function MyTasksScreen(): JSX.Element {
  const data = useQuery(api.tasks.mine);
  const extensions = useQuery(api.extensions.pending);
  const reviews = useQuery(api.reviews.waiting);
  const waitingOnMe = (extensions ?? []).filter((e) => e.canDecide);
  // Peer reviews of tasks you review, and submissions you can verify.
  const toReview = [...(reviews?.peerReviews ?? []), ...(reviews?.verifications ?? [])];
  const user = useSignedInUser();
  const router = useRouter();
  const now = useNow();
  const c = usePageColors();
  // The form creates a task for admins and a proposal for members, so say which.
  const newLabel = user.role === "admin" ? "New task" : "Propose task";

  if (data === undefined) {
    return (
      <Screen title="My Tasks">
        <Spinner />
      </Screen>
    );
  }
  const featureTitle = new Map(data.features.map((f) => [f._id, f.title]));
  const openTask = (taskId: string) =>
    router.push({ pathname: "/tasks/[taskId]", params: { taskId } });

  return (
    <Screen
      title="My Tasks"
      subtitle="What's waiting on you, what you own (soonest deadline first) and what you've proposed."
      action={
        <Button size="sm" variant="secondary" onPress={() => router.push("/tasks/new")}>
          {newLabel}
        </Button>
      }
    >
      {toReview.length > 0 ? (
        <View style={{ gap: 12 }}>
          <SectionTitle s={1} title="Reviews waiting on you" count={toReview.length} />
          {toReview.map((item) => (
            <TaskRow
              key={item.review._id}
              task={item.task}
              now={now}
              featureTitle={item.feature?.title}
              onPress={() => openTask(item.task._id)}
            />
          ))}
        </View>
      ) : null}
      {waitingOnMe.length > 0 ? (
        <View style={{ gap: 12 }}>
          <SectionTitle s={1} title="Waiting on you" count={waitingOnMe.length} />
          {waitingOnMe.map((item) => (
            <ExtensionRow
              key={item.request._id}
              s={1}
              item={item}
              now={now}
              onPress={() => openTask(item.task._id)}
            />
          ))}
        </View>
      ) : null}
      <View style={{ gap: 12 }}>
        <SectionTitle s={1} title="Assigned to me" count={data.owned.length} />
        {data.owned.length === 0 ? (
          <Text
            style={{ fontFamily: fonts.medium, fontSize: 15, color: c.muted, paddingHorizontal: 4 }}
          >
            Nothing assigned to you yet.
          </Text>
        ) : (
          data.owned.map((task) => (
            <TaskRow
              key={task._id}
              task={task}
              now={now}
              featureTitle={featureTitle.get(task.featureId)}
              onPress={() => openTask(task._id)}
            />
          ))
        )}
      </View>
      {data.proposals.length > 0 ? (
        <View style={{ gap: 12 }}>
          <SectionTitle s={1} title="My proposals" count={data.proposals.length} />
          {data.proposals.map((task) => (
            <TaskRow
              key={task._id}
              task={task}
              now={now}
              featureTitle={featureTitle.get(task.featureId)}
              onPress={() => openTask(task._id)}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
