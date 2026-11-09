import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Button, Card, Chip, Separator, Spinner, Typography } from "heroui-native";
import { Fragment, type JSX } from "react";
import { View } from "react-native";

import { api } from "@convex/_generated/api";

import { Section } from "@/components/planning/detail";
import { TaskCard } from "@/components/planning/task-card";
import { Screen } from "@/components/screen";
import { ROLE_LABELS } from "@/constants/labels";
import { typography } from "@/constants/theme";

/**
 * Admin-only. The tab is hidden from members, and `invites.list` itself throws for
 * non-admins. User management arrives in a later phase.
 */
export default function AdminScreen(): JSX.Element {
  const router = useRouter();
  const proposals = useQuery(api.tasks.proposals);
  const invites = useQuery(api.invites.list);
  const featureTitle = new Map((proposals?.features ?? []).map((f) => [f._id, f.title]));

  return (
    <Screen
      title="Admin"
      subtitle="Proposals to review, and who's invited."
      action={
        <Button size="sm" onPress={() => router.push("/features/new")}>
          New feature
        </Button>
      }
    >
      {proposals === undefined ? (
        <Spinner />
      ) : (
        <Section
          title="Proposals to review"
          count={proposals.proposals.length}
          empty="Nothing waiting. Proposals from the team show up here."
        >
          <View className="gap-3">
            {proposals.proposals.map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                featureTitle={featureTitle.get(task.featureId)}
              />
            ))}
          </View>
        </Section>
      )}

      <View className="gap-3">
        <Typography.Heading type={typography.sectionTitle}>Invites</Typography.Heading>
        <Card>
          <Card.Body className="gap-3">
            {invites === undefined ? (
              <Spinner />
            ) : invites.length === 0 ? (
              <Typography type={typography.body} color="muted">
                No invites yet. Seed them from the CLI (see CLAUDE.md).
              </Typography>
            ) : (
              invites.map((invite, index) => (
                <Fragment key={invite._id}>
                  {index > 0 ? <Separator /> : null}
                  <View className="flex-row items-center justify-between gap-3">
                    <View className="flex-1 gap-0.5">
                      <Typography type={typography.body} numberOfLines={1}>
                        {invite.email}
                      </Typography>
                      <Typography type={typography.caption} color="muted">
                        {invite.title} · {ROLE_LABELS[invite.role]}
                      </Typography>
                    </View>
                    <Chip
                      size="sm"
                      variant="soft"
                      color={invite.usedAt === undefined ? "warning" : "success"}
                    >
                      {invite.usedAt === undefined ? "Pending" : "Joined"}
                    </Chip>
                  </View>
                </Fragment>
              ))
            )}
          </Card.Body>
        </Card>
      </View>
    </Screen>
  );
}
