import { useMutation } from "convex/react";
import { Typography } from "heroui-native";
import { useState, type JSX } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { api } from "@convex/_generated/api";
import type { OwnerStatus, TaskStatus } from "@convex/lib/validators";
import { OWNER_STATUSES } from "@convex/lib/validators";
import type { TaskView } from "@convex/lib/views";

import { SaveSheet } from "@/components/ui/save-sheet";
import { SheetScrollView } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { fonts, usePageColors } from "@/components/ui/theme";
import { TASK_STATUS_LABELS } from "@/constants/labels";

import { ProgressSlider } from "./progress-slider";

function asOwnerStatus(status: TaskStatus): OwnerStatus {
  return (OWNER_STATUSES as readonly TaskStatus[]).includes(status)
    ? (status as OwnerStatus)
    : "in_progress"; // sent back with changes requested: back to work
}

/**
 * The owner's update on their task, in a card over the page: its status (to do, in progress,
 * blocked), its progress on a drag bar, and a note, needed when marking it blocked. Posted
 * together as one update (tasks.postUpdate), which shows in the task's history.
 */
export function UpdateSheet({
  task,
  onClose,
}: {
  task: TaskView;
  onClose: () => void;
}): JSX.Element {
  const c = usePageColors();
  const postUpdate = useMutation(api.tasks.postUpdate);
  const toast = useToast();
  const [status, setStatus] = useState<OwnerStatus>(asOwnerStatus(task.status));
  const [progress, setProgress] = useState(task.progress);
  const [note, setNote] = useState("");

  const isBlocking = status === "blocked" && task.status !== "blocked";
  const changed = status !== task.status || progress !== task.progress || note.trim() !== "";

  return (
    <SaveSheet
      title="Update this task"
      note="Where it stands, for the team. Posted to its history."
      isChanged={changed}
      problem={
        isBlocking && note.trim() === "" ? "Say what's blocking it, so the team can help." : null
      }
      saveLabel="Post update"
      onSave={async () => {
        await postUpdate({ taskId: task._id, status, progress, note });
        toast("Update posted");
      }}
      onClose={onClose}
    >
      <SheetScrollView
        contentContainerStyle={{ gap: 20, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}
      >
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="Status"
          style={{ flexDirection: "row", gap: 8 }}
        >
          {OWNER_STATUSES.map((option) => {
            const isChosen = option === status;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ checked: isChosen }}
                aria-checked={isChosen}
                accessibilityLabel={TASK_STATUS_LABELS[option]}
                onPress={() => setStatus(option)}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 44,
                  paddingHorizontal: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: isChosen ? c.accent : c.hairline,
                  backgroundColor: isChosen ? c.accent : c.panelRaised,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: fonts.bold,
                    fontSize: 14,
                    color: isChosen ? c.accentText : c.text,
                  }}
                >
                  {TASK_STATUS_LABELS[option]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ProgressSlider value={progress} onChange={setProgress} />

        <View style={{ gap: 6 }}>
          <Typography type="body-sm" weight="medium">
            {status === "blocked" ? "What's in the way?" : "Note (optional)"}
          </Typography>
          <TextInput
            accessibilityLabel={status === "blocked" ? "What's in the way?" : "Note"}
            value={note}
            onChangeText={setNote}
            placeholder={
              status === "blocked"
                ? "e.g. Waiting for the API keys"
                : "e.g. Two of three screens done"
            }
            placeholderTextColor={c.placeholder}
            selectionColor={c.text}
            cursorColor={c.text}
            multiline
            maxLength={1000}
            textAlignVertical="top"
            className="min-h-20 rounded-2xl border border-border bg-field px-4 py-3 text-base text-field-foreground focus:border-foreground"
          />
        </View>
      </SheetScrollView>
    </SaveSheet>
  );
}
