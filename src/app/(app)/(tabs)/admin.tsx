import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Button, Card, Chip, Separator, Spinner, Typography } from "heroui-native";
import { Fragment, useState, type JSX } from "react";
import { Text, View } from "react-native";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { formatDeadline } from "@convex/lib/dates";
import { formatInviteCode } from "@convex/lib/inviteCodes";

import { FormError } from "@/components/planning/form-error";
import { Screen } from "@/components/screen";
import { SectionTitle } from "@/components/ui/panel";
import { TaskRow } from "@/components/ui/task-row";
import { fonts, usePageColors } from "@/components/ui/theme";
import { ROLE_LABELS } from "@/constants/labels";
import { typography } from "@/constants/theme";
import { getErrorMessage } from "@/lib/errors";
import { useNow } from "@/lib/use-now";

/**
 * Admin-only. The tab is hidden from members, and `invites.list` itself throws for
 * non-admins. Pending invites show their one-time code to send to the person (long-press to
 * copy) and a New code button for lost or expired ones. User management arrives in a later phase.
 */
export default function AdminScreen(): JSX.Element {
  const router = useRouter();
  const proposals = useQuery(api.tasks.proposals);
  const invites = useQuery(api.invites.list);
  const renew = useMutation(api.invites.renew);
  const now = useNow();
  const c = usePageColors();
  const [renewing, setRenewing] = useState<Id<"invites"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const featureTitle = new Map((proposals?.features ?? []).map((f) => [f._id, f.title]));

  async function newCode(inviteId: Id<"invites">) {
    setError(null);
    setRenewing(inviteId);
    try {
      await renew({ inviteId });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setRenewing(null);
    }
  }

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

      <View className="gap-3">
        <Typography.Heading type={typography.sectionTitle}>Invites</Typography.Heading>
        <FormError message={error} />
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
                  <InviteRow
                    invite={invite}
                    now={now}
                    isRenewing={renewing === invite._id}
                    onNewCode={() => newCode(invite._id)}
                  />
                </Fragment>
              ))
            )}
          </Card.Body>
        </Card>
      </View>
    </Screen>
  );
}

function InviteRow({
  invite,
  now,
  isRenewing,
  onNewCode,
}: {
  invite: Doc<"invites">;
  now: number;
  isRenewing: boolean;
  onNewCode: () => void;
}): JSX.Element {
  const joined = invite.usedAt !== undefined;
  const expired = invite.expiresAt !== undefined && invite.expiresAt < now;
  const hasCode = invite.code !== undefined && !expired;

  let codeLine: string | null = null;
  if (!joined) {
    if (invite.code === undefined) codeLine = "No code yet. Tap New code, then send it to them.";
    else if (expired) codeLine = "Code expired. Tap New code, then send it to them.";
    else if (invite.expiresAt !== undefined) {
      codeLine = `Expires ${formatDeadline(invite.expiresAt, now)}`;
    }
  }

  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 gap-0.5">
          <Typography type={typography.body} numberOfLines={1}>
            {invite.email}
          </Typography>
          <Typography type={typography.caption} color="muted">
            {invite.title} · {ROLE_LABELS[invite.role]}
          </Typography>
        </View>
        <Chip size="sm" variant="soft" color={joined ? "success" : "warning"}>
          {joined ? "Joined" : "Pending"}
        </Chip>
      </View>
      {!joined ? (
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1 gap-0.5">
            {hasCode && invite.code !== undefined ? (
              <Typography
                type={typography.body}
                weight="semibold"
                selectable
                accessibilityLabel={`Invite code ${invite.code.split("").join(" ")}`}
              >
                {formatInviteCode(invite.code)}
              </Typography>
            ) : null}
            {codeLine !== null ? (
              <Typography type={typography.caption} color="muted">
                {codeLine}
              </Typography>
            ) : null}
          </View>
          <Button size="sm" variant="secondary" onPress={onNewCode} isDisabled={isRenewing}>
            {isRenewing ? "Making…" : "New code"}
          </Button>
        </View>
      ) : null}
    </View>
  );
}
