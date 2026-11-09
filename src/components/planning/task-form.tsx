import { useQuery } from "convex/react";
import { Button, Description, Input, Label, TextField, Typography } from "heroui-native";
import { useState, type JSX } from "react";
import { View } from "react-native";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { formatDeadline, toDateOnly } from "@convex/lib/dates";
import type { TaskKind, TaskPriority } from "@convex/lib/validators";

import { Screen } from "@/components/screen";
import {
  KIND_ORDER,
  PRIORITY_ORDER,
  TASK_KIND_LABELS,
  TASK_PRIORITY_LABELS,
} from "@/constants/labels";
import { getErrorMessage } from "@/lib/errors";
import { useNow } from "@/lib/use-now";

import { ChoiceChips } from "./choice-chips";
import { CriteriaEditor } from "./criteria-editor";
import { DateField } from "./date-field";
import { FormError } from "./form-error";
import { OptionPicker } from "./option-picker";

export type TaskFormValues = {
  featureId: Id<"features"> | null;
  title: string;
  description: string;
  kind: TaskKind;
  acceptanceCriteria: string[];
  priority: TaskPriority;
  ownerId: Id<"users"> | null;
  peerReviewerId: Id<"users"> | null;
  deadline: string; // "YYYY-MM-DD"
};

export const EMPTY_TASK: TaskFormValues = {
  featureId: null,
  title: "",
  description: "",
  kind: "code",
  acceptanceCriteria: [""],
  priority: "medium",
  ownerId: null,
  peerReviewerId: null,
  deadline: "",
};

/** Form values → the plan arguments `tasks.create/update/approveProposal` take. */
export function toTaskPlan(values: TaskFormValues) {
  if (values.ownerId === null) throw new Error("Owner is required.");
  return {
    title: values.title,
    description: values.description,
    kind: values.kind,
    acceptanceCriteria: values.acceptanceCriteria,
    ownerId: values.ownerId,
    peerReviewerId: values.kind === "code" ? (values.peerReviewerId ?? undefined) : undefined,
    deadline: values.deadline,
    priority: values.priority,
  };
}

/** A task document → form values, for editing or approving it. */
export function taskToFormValues(task: Doc<"tasks">): TaskFormValues {
  return {
    featureId: task.featureId,
    title: task.title,
    description: task.description,
    kind: task.kind,
    acceptanceCriteria: task.acceptanceCriteria.length > 0 ? task.acceptanceCriteria : [""],
    priority: task.priority,
    ownerId: task.ownerId ?? null,
    peerReviewerId: task.peerReviewerId ?? null,
    deadline: task.deadline !== undefined ? toDateOnly(task.deadline) : "",
  };
}

/**
 * - create / edit / approve (admin): the full plan — owner, reviewer, deadline, criteria.
 * - propose (anyone): what and why; the admin assigns owner and deadline on approval.
 */
export type TaskFormMode = "create" | "edit" | "approve" | "propose";

const SUBMIT_LABELS: Record<TaskFormMode, string> = {
  create: "Create task",
  edit: "Save changes",
  approve: "Approve task",
  propose: "Send proposal",
};

export function TaskForm({
  mode,
  initial,
  lockFeature = false,
  onSubmit,
}: {
  mode: TaskFormMode;
  initial: TaskFormValues;
  /** The feature can't be changed (editing, approving, or opened from a feature page). */
  lockFeature?: boolean;
  onSubmit: (values: TaskFormValues) => Promise<void>;
}): JSX.Element {
  const features = useQuery(api.features.list);
  const users = useQuery(api.users.list);
  const [values, setValues] = useState(initial);
  const today = toDateOnly(useNow());
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isPlanning = mode !== "propose";

  const feature = features?.find((f) => f._id === values.featureId);
  const openFeatures = (features ?? []).filter(
    (f) => f.status !== "shipped" || f._id === values.featureId
  );
  const activeUsers = (users ?? []).filter((u) => u.isActive);
  const userOptions = activeUsers.map((u) => ({
    value: u._id,
    label: u.name,
    description: u.title,
  }));

  function set<K extends keyof TaskFormValues>(field: K, value: TaskFormValues[K]) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  function validate(): string | null {
    if (values.featureId === null) return "Choose the feature this task belongs to.";
    if (values.title.trim() === "") return "Give the task a title.";
    if (!isPlanning && values.description.trim() === "") {
      return "Describe the task so the admin can decide.";
    }
    if (isPlanning) {
      if (values.acceptanceCriteria.every((c) => c.trim() === "")) {
        return "Add at least one acceptance criterion.";
      }
      if (values.ownerId === null) return "Choose who owns this task.";
      if (values.kind === "code" && values.peerReviewerId === null) {
        return "Code tasks need a peer reviewer.";
      }
      if (values.deadline === "") return "Pick a deadline.";
    }
    return null;
  }

  async function submit() {
    const problem = validate();
    if (problem !== null) {
      setError(problem);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(values);
    } catch (e) {
      setError(getErrorMessage(e));
      setIsSubmitting(false);
    }
  }

  return (
    <Screen
      withHeader
      footer={
        <Button onPress={submit} isDisabled={isSubmitting}>
          {isSubmitting ? "Saving…" : SUBMIT_LABELS[mode]}
        </Button>
      }
    >
      <FormError message={error} />
      {mode === "propose" ? (
        <Typography type="body-sm" color="muted">
          Proposals go to the admin, who sets the owner, deadline and final acceptance criteria
          before the task goes live.
        </Typography>
      ) : null}

      <OptionPicker
        label="Feature"
        value={values.featureId}
        options={openFeatures.map((f) => ({
          value: f._id,
          label: f.title,
          description: `Due ${formatDeadline(f.deadline)}`,
        }))}
        onChange={(id) => set("featureId", id)}
        placeholder={features === undefined ? "Loading…" : "Choose a feature"}
        isDisabled={lockFeature}
      />

      <TextField isRequired>
        <Label>Title</Label>
        <Input
          value={values.title}
          onChangeText={(text) => set("title", text)}
          placeholder="e.g. Build the sign-up API"
        />
      </TextField>
      <TextField isRequired={!isPlanning}>
        <Label>Description</Label>
        <Input
          value={values.description}
          onChangeText={(text) => set("description", text)}
          placeholder={isPlanning ? "Context for the owner (optional)" : "What and why?"}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </TextField>

      <ChoiceChips
        label="Type"
        value={values.kind}
        options={KIND_ORDER.map((k) => ({ value: k, label: TASK_KIND_LABELS[k] }))}
        onChange={(kind) => set("kind", kind)}
      />
      <ChoiceChips
        label="Priority"
        value={values.priority}
        options={PRIORITY_ORDER.map((p) => ({ value: p, label: TASK_PRIORITY_LABELS[p] }))}
        onChange={(priority) => set("priority", priority)}
      />

      <CriteriaEditor
        value={values.acceptanceCriteria}
        onChange={(criteria) => set("acceptanceCriteria", criteria)}
        label={isPlanning ? "Acceptance criteria" : "Suggested acceptance criteria"}
        hint="How the verifier will know it's done. One check per line."
      />

      {isPlanning ? (
        <View className="gap-6">
          <OptionPicker
            label="Owner"
            value={values.ownerId}
            options={userOptions}
            onChange={(id) => set("ownerId", id)}
            placeholder="Choose the owner"
          />
          {values.kind === "code" ? (
            <View className="gap-1.5">
              <OptionPicker
                label="Peer reviewer"
                value={values.peerReviewerId}
                options={userOptions.filter((o) => o.value !== values.ownerId)}
                onChange={(id) => set("peerReviewerId", id)}
                placeholder="Choose a reviewer"
              />
              <Description>
                Reviews the code before it&apos;s submitted for verification.
              </Description>
            </View>
          ) : null}
          <DateField
            label="Deadline"
            value={values.deadline}
            onChange={(date) => set("deadline", date)}
            minimumDate={today}
            maximumDate={feature !== undefined ? toDateOnly(feature.deadline) : undefined}
            hint={
              feature !== undefined
                ? `On or before the feature's deadline (${formatDeadline(feature.deadline)}).`
                : undefined
            }
          />
        </View>
      ) : null}
    </Screen>
  );
}
