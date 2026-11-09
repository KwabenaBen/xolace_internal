import { useQuery } from "convex/react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Button, Card, Separator, Typography } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import { LoadingScreen } from "@/components/loading-screen";
import { FeatureStatusChip } from "@/components/planning/badges";
import { DeadlineText } from "@/components/planning/deadline-text";
import { DetailRow, Section } from "@/components/planning/detail";
import { NotFound } from "@/components/planning/not-found";
import { TaskCard } from "@/components/planning/task-card";
import { Screen } from "@/components/screen";
import { useSignedInUser } from "@/lib/use-current-user";

export default function FeatureScreen(): JSX.Element {
  const { featureId } = useLocalSearchParams<{ featureId: Id<"features"> }>();
  const data = useQuery(api.features.get, { featureId });
  const user = useSignedInUser();
  const router = useRouter();
  const isAdmin = user.role === "admin";

  if (data === undefined) return <LoadingScreen />;
  if (data === null) return <NotFound what="feature" />;
  const { feature, createdBy, tasks, proposals } = data;
  const canAddWork = feature.status !== "shipped";

  return (
    <Screen withHeader>
      <Stack.Screen options={{ title: feature.title }} />

      <View className="gap-2">
        <View className="flex-row flex-wrap items-center gap-2">
          <FeatureStatusChip status={feature.status} />
          <DeadlineText deadline={feature.deadline} prefix="Deadline" />
        </View>
        <Typography.Heading type="h3">{feature.title}</Typography.Heading>
      </View>

      <Card>
        <Card.Body className="gap-4">
          <DetailRow label="Description">{feature.description}</DetailRow>
          <DetailRow label="Expected result">{feature.expectedResult}</DetailRow>
          {feature.sourceNote !== "" ? (
            <DetailRow label="Source">{feature.sourceNote}</DetailRow>
          ) : null}
          <Separator />
          <Typography type="body-xs" color="muted">
            Planned by {createdBy?.name ?? "an admin"}
          </Typography>
        </Card.Body>
      </Card>

      <View className="flex-row flex-wrap gap-3">
        {isAdmin ? (
          <>
            {canAddWork ? (
              <Button
                className="flex-1"
                onPress={() =>
                  router.push({ pathname: "/tasks/new", params: { featureId: feature._id } })
                }
              >
                Add task
              </Button>
            ) : null}
            <Button
              variant="secondary"
              className="flex-1"
              onPress={() =>
                router.push({
                  pathname: "/features/[featureId]/edit",
                  params: { featureId: feature._id },
                })
              }
            >
              Edit feature
            </Button>
          </>
        ) : canAddWork ? (
          <Button
            variant="secondary"
            className="flex-1"
            onPress={() =>
              router.push({ pathname: "/tasks/new", params: { featureId: feature._id } })
            }
          >
            Propose a task
          </Button>
        ) : null}
      </View>

      <Section title="Tasks" count={tasks.length} empty="No tasks yet.">
        <View className="gap-3">
          {tasks.map((task) => (
            <TaskCard key={task._id} task={task} />
          ))}
        </View>
      </Section>

      {proposals.length > 0 ? (
        <Section title="Proposals waiting for approval" count={proposals.length}>
          <View className="gap-3">
            {proposals.map((task) => (
              <TaskCard key={task._id} task={task} />
            ))}
          </View>
        </Section>
      ) : null}
    </Screen>
  );
}
