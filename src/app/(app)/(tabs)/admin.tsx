import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Button, Spinner } from "heroui-native";
import type { JSX } from "react";
import { Text, View } from "react-native";

import { api } from "@convex/_generated/api";

import { Screen } from "@/components/screen";
import { SectionTitle } from "@/components/ui/panel";
import { TaskRow } from "@/components/ui/task-row";
import { fonts, usePageColors } from "@/components/ui/theme";
import { useNow } from "@/lib/use-now";

/**
 * The Admin tab, shown to admins only (every admin action is also checked on the server): the
 * team's task proposals waiting for review, and New feature. Invites and the team itself live in
 * Settings → People.
 */
export default function AdminScreen(): JSX.Element {
  const router = useRouter();
  const proposals = useQuery(api.tasks.proposals);
  const now = useNow();
  const c = usePageColors();
  const featureTitle = new Map((proposals?.features ?? []).map((f) => [f._id, f.title]));

  return (
    <Screen
      title="Admin"
      subtitle="Proposals waiting for your review. Invites are in Settings → People."
      action={
        <Button size="sm" onPress={() => router.push("/features/new")}>
          New feature
        </Button>
      }
    >
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
                onPress={() =>
                  router.push({ pathname: "/tasks/[taskId]", params: { taskId: task._id } })
                }
              />
            ))
          )}
        </View>
      )}
    </Screen>
  );
}
