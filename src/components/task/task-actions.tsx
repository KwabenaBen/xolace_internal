import { useMutation } from "convex/react";
import { useState, type JSX } from "react";
import { Text, TextInput, View } from "react-native";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import { PillButton } from "@/components/auth/pill-button";
import { fonts } from "@/components/board/board-theme";
import { getErrorMessage } from "@/lib/errors";

import { taskColors } from "./task-theme";

/** Two pills side by side (or one full width). */
export function PillRow({ children }: { children: JSX.Element[] | JSX.Element }): JSX.Element {
  const items = Array.isArray(children) ? children : [children];
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      {items.map((child, index) => (
        <View key={index} style={{ flex: 1 }}>
          {child}
        </View>
      ))}
    </View>
  );
}

/**
 * The admin's buttons, as the sign-in screens' big pills: edit a live task, or approve (opens the
 * plan form) or decline a proposal, with a reason. Members get none (until Phase 3's status
 * updates), so this renders nothing for them.
 */
export function TaskActions({
  taskId,
  isAdmin,
  isProposal,
  isDeclined,
  onEdit,
}: {
  taskId: Id<"tasks">;
  isAdmin: boolean;
  isProposal: boolean;
  isDeclined: boolean;
  onEdit: () => void;
}): JSX.Element | null {
  if (!isAdmin || isDeclined) return null;
  if (isProposal) return <ProposalActions taskId={taskId} onApprove={onEdit} />;
  return (
    <PillRow>
      <PillButton label="Edit task" onPress={onEdit} />
    </PillRow>
  );
}

function ProposalActions({
  taskId,
  onApprove,
}: {
  taskId: Id<"tasks">;
  onApprove: () => void;
}): JSX.Element {
  const declineProposal = useMutation(api.tasks.declineProposal);
  const [isDeclining, setIsDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function decline() {
    if (reason.trim() === "") {
      setError("Give a reason so the proposer knows why.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await declineProposal({ taskId, reason });
      setIsDeclining(false);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isDeclining) {
    return (
      <PillRow>
        <PillButton label="Decline" variant="dark" onPress={() => setIsDeclining(true)} />
        <PillButton label="Review & approve" onPress={onApprove} />
      </PillRow>
    );
  }

  return (
    <View
      style={{
        gap: 14,
        borderRadius: 26,
        backgroundColor: taskColors.panel,
        borderWidth: 1,
        borderColor: taskColors.hairline,
        padding: 18,
      }}
    >
      <Text style={{ fontFamily: fonts.extraBold, fontSize: 17, color: taskColors.white }}>
        Why are you declining it?
      </Text>
      {error !== null ? (
        <Text
          accessibilityRole="alert"
          style={{ fontFamily: fonts.semibold, fontSize: 14, color: "rgb(255,120,120)" }}
        >
          {error}
        </Text>
      ) : null}
      <TextInput
        accessibilityLabel="Why are you declining it?"
        value={reason}
        onChangeText={setReason}
        placeholder="e.g. Out of scope for v1"
        placeholderTextColor="#737373"
        selectionColor="#ffffff"
        cursorColor="#ffffff"
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        autoFocus
        className="min-h-24 rounded-2xl border border-neutral-800 bg-neutral-900 px-5 py-4 text-base text-white focus:border-neutral-400"
      />
      <PillRow>
        <PillButton label="Cancel" variant="dark" onPress={() => setIsDeclining(false)} />
        <PillButton
          label={isSubmitting ? "Declining…" : "Decline"}
          onPress={decline}
          isLoading={isSubmitting}
        />
      </PillRow>
    </View>
  );
}
