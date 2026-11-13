import { Stack } from "expo-router";
import { Description, Input, Label, TextField, Typography } from "heroui-native";
import { useState, type JSX } from "react";
import { Pressable, View } from "react-native";

import { DAILY_LOG_LIMITS } from "@convex/lib/constants";
import type { TaskStatus } from "@convex/lib/validators";

import { FormError } from "@/components/planning/form-error";
import { useUnsavedGuard } from "@/components/planning/use-unsaved-guard";
import { Screen } from "@/components/screen";
import { SaveButton } from "@/components/ui/save-button";
import { STATUS_COLORS } from "@/components/ui/theme";
import { TASK_STATUS_LABELS } from "@/constants/labels";
import { getErrorMessage } from "@/lib/errors";

export type LogFormValues = {
  done: string;
  next: string;
  blockers: string;
  taskIds: string[];
};

export type LinkableTask = { _id: string; title: string; status: TaskStatus };

/**
 * Today's log (a form modal: a sheet on the phone, a dialog on the website). On a weekday: what
 * you did (required), what's next, what's in the way, and the tasks it was about. At the weekend:
 * one line. The server re-checks every rule, including that the day hasn't ended.
 */
export function LogForm({
  initial,
  isWeekend,
  isEdit: wasEdit,
  tasks,
  onSubmit,
  onSaved,
}: {
  initial: LogFormValues;
  isWeekend: boolean;
  isEdit: boolean;
  /** The tasks you can link (your open ones, those you review, and any already linked). */
  tasks: LinkableTask[];
  /** Saves; throws to show why it couldn't. */
  onSubmit: (values: LogFormValues) => Promise<void>;
  /** Once the button has shown "Saved" (close the form). */
  onSaved: () => void;
}): JSX.Element {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  // Whether it opened on a log already written: saving a new one mustn't relabel the form mid-way.
  const [isEdit] = useState(wasEdit);
  const guard = useUnsavedGuard(initial, values);
  const set = (field: "done" | "next" | "blockers") => (text: string) =>
    setValues((v) => ({ ...v, [field]: text }));
  const toggleTask = (taskId: string) =>
    setValues((v) => ({
      ...v,
      taskIds: v.taskIds.includes(taskId)
        ? v.taskIds.filter((id) => id !== taskId)
        : [...v.taskIds, taskId],
    }));

  function validate(): boolean {
    if (values.done.trim() === "") {
      setError(isWeekend ? "Write your line first." : "Say what you did today.");
      return false;
    }
    setError(null);
    return true;
  }

  async function save(): Promise<boolean> {
    guard.markSaving();
    try {
      await onSubmit(values);
      return true;
    } catch (e) {
      setError(getErrorMessage(e));
      guard.markFailed();
      return false;
    }
  }

  const title = isWeekend ? "Weekend line" : isEdit ? "Edit today's log" : "Today's log";
  const label = isEdit ? "Save changes" : isWeekend ? "Save line" : "Save log";

  return (
    <>
      <Stack.Screen options={{ title }} />
      <Screen
        withHeader
        dialogTitle={title}
        footer={
          <View className="gap-3">
            <FormError message={error} />
            <SaveButton
              labels={{ idle: label, busy: "Saving", done: "Saved" }}
              validate={validate}
              onPress={save}
              onDone={onSaved}
            />
          </View>
        }
      >
        <Typography type="body-sm" color="muted">
          {isWeekend
            ? "Weekends are optional: one line if you did something worth noting. It never counts as missed."
            : "You can change it until midnight (GMT). After that the day is locked, and a weekday with no log counts as missed."}
        </Typography>
        {isWeekend ? (
          <TextField isRequired>
            <Label>Your line</Label>
            <Input
              value={values.done}
              onChangeText={set("done")}
              placeholder="e.g. Read through the partner's API docs"
              maxLength={DAILY_LOG_LIMITS.weekendLine}
            />
          </TextField>
        ) : (
          <>
            <TextField isRequired>
              <Label>What did you do today?</Label>
              <Input
                value={values.done}
                onChangeText={set("done")}
                placeholder="e.g. Finished the sign-up screen's error states"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={DAILY_LOG_LIMITS.done}
              />
            </TextField>
            <TextField>
              <Label>What&apos;s next?</Label>
              <Input
                value={values.next}
                onChangeText={set("next")}
                placeholder="e.g. Tests for the expired-code path"
                multiline
                numberOfLines={2}
                textAlignVertical="top"
                maxLength={DAILY_LOG_LIMITS.next}
              />
            </TextField>
            <TextField>
              <Label>Anything in your way?</Label>
              <Input
                value={values.blockers}
                onChangeText={set("blockers")}
                placeholder="Leave it empty if nothing is"
                multiline
                numberOfLines={2}
                textAlignVertical="top"
                maxLength={DAILY_LOG_LIMITS.blockers}
              />
              <Description>Blockers show on the team&apos;s view, so someone can help.</Description>
            </TextField>
            <TaskChips tasks={tasks} selected={values.taskIds} onToggle={toggleTask} />
          </>
        )}
      </Screen>
    </>
  );
}

/** The tasks to link, as pills you tick on and off (each with its status colour). */
function TaskChips({
  tasks,
  selected,
  onToggle,
}: {
  tasks: LinkableTask[];
  selected: string[];
  onToggle: (taskId: string) => void;
}): JSX.Element {
  return (
    <View className="gap-1.5">
      <Typography type="body-sm" weight="medium">
        Tasks it was about
      </Typography>
      {tasks.length === 0 ? (
        <Typography type="body-sm" color="muted">
          You have no open tasks to link.
        </Typography>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {tasks.map((task) => {
            const isOn = selected.includes(task._id);
            return (
              <Pressable
                key={task._id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isOn }}
                aria-checked={isOn}
                accessibilityLabel={`${task.title}, ${TASK_STATUS_LABELS[task.status]}`}
                onPress={() => onToggle(task._id)}
                className={`max-w-full flex-row items-center gap-2 rounded-full border px-4 py-2 active:opacity-70 ${
                  isOn ? "border-accent bg-accent" : "border-border bg-surface"
                }`}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: STATUS_COLORS[task.status].fill,
                  }}
                />
                <Typography
                  type="body-sm"
                  weight="medium"
                  numberOfLines={1}
                  className={`shrink ${isOn ? "text-accent-foreground" : ""}`}
                >
                  {task.title}
                </Typography>
              </Pressable>
            );
          })}
        </View>
      )}
      <Typography type="body-sm" color="muted">
        Your open tasks and the ones you peer-review. Optional.
      </Typography>
    </View>
  );
}
