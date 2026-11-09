import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Button, Spinner } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

import { api } from "@convex/_generated/api";

import { Section } from "@/components/planning/detail";
import { TaskCard } from "@/components/planning/task-card";
import { Screen } from "@/components/screen";

export default function MyTasksScreen(): JSX.Element {
  const data = useQuery(api.tasks.mine);
  const router = useRouter();

  if (data === undefined) {
    return (
      <Screen title="My Tasks">
        <Spinner />
      </Screen>
    );
  }
  const featureTitle = new Map(data.features.map((f) => [f._id, f.title]));

  return (
    <Screen
      title="My Tasks"
      subtitle="What you own, soonest deadline first, and what you've proposed."
      action={
        <Button size="sm" variant="secondary" onPress={() => router.push("/tasks/new")}>
          Propose task
        </Button>
      }
    >
      <Section
        title="Assigned to me"
        count={data.owned.length}
        empty="Nothing assigned to you yet."
      >
        <View className="gap-3">
          {data.owned.map((task) => (
            <TaskCard key={task._id} task={task} featureTitle={featureTitle.get(task.featureId)} />
          ))}
        </View>
      </Section>
      {data.proposals.length > 0 ? (
        <Section title="My proposals" count={data.proposals.length}>
          <View className="gap-3">
            {data.proposals.map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                featureTitle={featureTitle.get(task.featureId)}
              />
            ))}
          </View>
        </Section>
      ) : null}
    </Screen>
  );
}
