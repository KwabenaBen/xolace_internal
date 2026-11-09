import { Button, Description, Input, Label, TextField } from "heroui-native";
import { useState, type JSX } from "react";
import { View } from "react-native";

import { toDateOnly } from "@convex/lib/dates";

import { Screen } from "@/components/screen";
import { getErrorMessage } from "@/lib/errors";
import { useNow } from "@/lib/use-now";

import { DateField } from "./date-field";
import { FormError } from "./form-error";
import { useUnsavedGuard } from "./use-unsaved-guard";

export type FeatureFormValues = {
  title: string;
  description: string;
  expectedResult: string;
  sourceNote: string;
  deadline: string; // "YYYY-MM-DD"
};

export const EMPTY_FEATURE: FeatureFormValues = {
  title: "",
  description: "",
  expectedResult: "",
  sourceNote: "",
  deadline: "",
};

/** Create/edit form for a feature (admin). The server re-checks every rule. */
export function FeatureForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: FeatureFormValues;
  submitLabel: string;
  onSubmit: (values: FeatureFormValues) => Promise<void>;
}): JSX.Element {
  const [values, setValues] = useState(initial);
  const today = toDateOnly(useNow());
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const guard = useUnsavedGuard(initial, values);
  const set = (field: keyof FeatureFormValues) => (text: string) =>
    setValues((v) => ({ ...v, [field]: text }));

  async function submit() {
    if (
      values.title.trim() === "" ||
      values.description.trim() === "" ||
      values.expectedResult.trim() === ""
    ) {
      setError("Add a title, a description and the expected result.");
      return;
    }
    if (values.deadline === "") {
      setError("Pick the feature's deadline.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    guard.markSaving();
    try {
      await onSubmit(values);
    } catch (e) {
      setError(getErrorMessage(e));
      guard.markFailed();
    } finally {
      // Also after a save, in case the screen stays open (nothing to go back to).
      setIsSubmitting(false);
    }
  }

  return (
    <Screen
      withHeader
      footer={
        // The error sits right above the button, where the eye is after tapping it.
        <View className="gap-3">
          <FormError message={error} />
          <Button onPress={submit} isDisabled={isSubmitting}>
            {isSubmitting ? "Saving…" : submitLabel}
          </Button>
        </View>
      }
    >
      <TextField isRequired>
        <Label>Title</Label>
        <Input
          value={values.title}
          onChangeText={set("title")}
          placeholder="e.g. Onboarding flow"
        />
      </TextField>
      <TextField isRequired>
        <Label>Description</Label>
        <Input
          value={values.description}
          onChangeText={set("description")}
          placeholder="What is this feature?"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </TextField>
      <TextField isRequired>
        <Label>Expected result</Label>
        <Input
          value={values.expectedResult}
          onChangeText={set("expectedResult")}
          placeholder="What does done look like?"
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </TextField>
      <TextField>
        <Label>Source</Label>
        <Input
          value={values.sourceNote}
          onChangeText={set("sourceNote")}
          placeholder="e.g. Weekly sync, 3 Nov"
        />
        <Description>Where this was agreed, e.g. which meeting.</Description>
      </TextField>
      <DateField
        label="Deadline"
        value={values.deadline}
        onChange={set("deadline")}
        minimumDate={today}
        hint="A hard deadline. Every task's deadline must be on or before it."
      />
    </Screen>
  );
}
