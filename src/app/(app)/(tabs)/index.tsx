import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Button, Spinner, Typography } from "heroui-native";
import { useState, type JSX } from "react";
import { Pressable, View } from "react-native";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { LiveTaskStatus } from "@convex/lib/validators";

import { FeatureGroup } from "@/components/planning/feature-group";
import { OptionPicker } from "@/components/planning/option-picker";
import { Screen } from "@/components/screen";
import { LIVE_STATUS_ORDER, TASK_STATUS_LABELS } from "@/constants/labels";
import { useSignedInUser } from "@/lib/use-current-user";

/** The shared board: every live task, grouped by feature, filterable by owner/feature/status. */
export default function BoardScreen(): JSX.Element {
  const user = useSignedInUser();
  const router = useRouter();
  const isAdmin = user.role === "admin";
  const [ownerId, setOwnerId] = useState<Id<"users"> | null>(null);
  const [featureId, setFeatureId] = useState<Id<"features"> | null>(null);
  const [status, setStatus] = useState<LiveTaskStatus | null>(null);

  const board = useQuery(api.tasks.board, {
    ...(ownerId !== null ? { ownerId } : {}),
    ...(featureId !== null ? { featureId } : {}),
    ...(status !== null ? { status } : {}),
  });
  const users = useQuery(api.users.list);
  const features = useQuery(api.features.list);
  const isFiltered = ownerId !== null || featureId !== null || status !== null;

  return (
    <Screen
      title="Board"
      subtitle="Every task, grouped by feature."
      action={
        isAdmin ? (
          <Button size="sm" onPress={() => router.push("/features/new")}>
            New feature
          </Button>
        ) : (
          <Button size="sm" variant="secondary" onPress={() => router.push("/tasks/new")}>
            Propose task
          </Button>
        )
      }
    >
      <View className="flex-row flex-wrap items-center gap-2">
        <OptionPicker
          variant="chip"
          label="Owner"
          value={ownerId}
          options={(users ?? []).map((u) => ({
            value: u._id,
            label: u.name,
            description: u.title,
          }))}
          onChange={setOwnerId}
          placeholder="Owner"
          clearLabel="Everyone"
        />
        <OptionPicker
          variant="chip"
          label="Feature"
          value={featureId}
          options={(features ?? []).map((f) => ({ value: f._id, label: f.title }))}
          onChange={setFeatureId}
          placeholder="Feature"
          clearLabel="All features"
        />
        <OptionPicker
          variant="chip"
          label="Status"
          value={status}
          options={LIVE_STATUS_ORDER.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s] }))}
          onChange={setStatus}
          placeholder="Status"
          clearLabel="Any status"
        />
        {isFiltered ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setOwnerId(null);
              setFeatureId(null);
              setStatus(null);
            }}
            className="px-2 py-1.5 active:opacity-60"
          >
            <Typography type="body-sm" className="text-link">
              Clear
            </Typography>
          </Pressable>
        ) : null}
      </View>

      {board === undefined ? (
        <Spinner />
      ) : board.length === 0 ? (
        <Typography type="body" color="muted">
          {isFiltered
            ? "No tasks match these filters."
            : isAdmin
              ? "Nothing planned yet. Start with “New feature”."
              : "Nothing planned yet. The admin adds features after each meeting."}
        </Typography>
      ) : (
        <View className="gap-8">
          {board.map((group) => (
            <FeatureGroup key={group.feature._id} feature={group.feature} tasks={group.tasks} />
          ))}
        </View>
      )}
    </Screen>
  );
}
