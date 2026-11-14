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
import { useNow } from "@/lib/use-now";

/**
 * The Admin tab, shown to admins only (every admin action is also checked on the server):
 * submissions to verify, requests for more time that are theirs to decide, the team's task
 * proposals waiting for review, and New feature. Invites and the team live in Settings → People.
 */
export default function AdminScreen(): JSX.Element {
  const router = useRouter();
  const proposals = useQuery(api.tasks.proposals);
  const extensions = useQuery(api.extensions.pending);
  const reviews = useQuery(api.reviews.waiting);
  const toDecide = (extensions ?? []).filter((e) => e.canDecide);
  const toVerify = reviews?.verifications ?? [];
  const openTask = (taskId: string) =>
    router.push({ pathname: "/tasks/[taskId]", params: { taskId } });
  const now = useNow();
  const c = usePageColors();
  const featureTitle = new Map((proposals?.features ?? []).map((f) => [f._id, f.title]));

  return (
    <Screen
      title="Admin"
      subtitle="Tasks to verify, requests and proposals waiting for you. Invites are in Settings → People."
      action={
        <Button size="sm" onPress={() => router.push("/features/new")}>
          New feature
        </Button>
      }
    >
      {toVerify.length > 0 ? (
        <View style={{ gap: 12 }}>
          <SectionTitle s={1} title="To verify" count={toVerify.length} />
          {toVerify.map((item) => (
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
      {toDecide.length > 0 ? (
        <View style={{ gap: 12 }}>
          <SectionTitle s={1} title="More time to decide" count={toDecide.length} />
          {toDecide.map((item) => (
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
      {proposals === undefined ? (
        <Spinner />
      ) : (
        <View style={{ gap: 12 }}>
          <SectionTitle s={1} title="Proposals to review" count={proposals.proposals.length} />
          {proposals.proposals.length === 0 ? (
            <Text
              style={{
                fontFamily: fonts.medium,
                fontSize: 15,
                color: c.muted,
                paddingHorizontal: 4,
              }}
            >
              Nothing waiting. Proposals from the team show up here.
            </Text>
          ) : (
            proposals.proposals.map((task) => (
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
      )}
    </Screen>
  );
}
