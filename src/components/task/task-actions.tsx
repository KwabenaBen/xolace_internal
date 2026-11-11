import { useMutation } from "convex/react";
import { useState, type JSX } from "react";
import { Text, TextInput, View } from "react-native";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import { PillButton, PillRow } from "@/components/ui/pill-button";
import { fonts, usePageColors } from "@/components/ui/theme";
import { getErrorMessage } from "@/lib/errors";
import { useToast } from "@/components/ui/toast";

/**
 * The admin's buttons, as the sign-in screens' big pills: edit a live task, or approve (opens the
 * plan form) or decline a proposal, with a reason. Members get none here (an owner's own buttons
 * are OwnerActions), so this renders nothing for them.
 */
export function TaskActions({
  taskId,
  isAdmin,
  isProposal,
  isDeclined,
  isLocked,
  onEdit,
}: {
  taskId: Id<"tasks">;
  isAdmin: boolean;
  isProposal: boolean;
  isDeclined: boolean;
  /** In review, submitted or verified: the plan can't change (the server refuses too). */
  isLocked: boolean;
  onEdit: () => void;
}): JSX.Element | null {
  const c = usePageColors();
  if (!isAdmin || isDeclined) return null;
  if (isProposal) return <ProposalActions taskId={taskId} onApprove={onEdit} />;
  if (isLocked) {
    return (
      <Text style={{ fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: c.muted }}>
        This task is in review, submitted or verified, so its plan is locked. It can change again
        once it&apos;s sent back to its owner.
      </Text>
    );
  }
  return (
    <PillRow>
      <PillButton label="Edit task" onPress={onEdit} />
    </PillRow>
  );
}

/**
 * The owner's buttons while the task is in their hands: post an update (status, progress, a
 * note) and ask for more time. Asking is hidden while a request is already waiting.
 */
export function OwnerActions({
  canExtend,
  onUpdate,
  onExtend,
}: {
  canExtend: boolean;
  onUpdate: () => void;
  onExtend: () => void;
}): JSX.Element {
  return canExtend ? (
    <PillRow>
      <PillButton label="Ask for more time" variant="secondary" onPress={onExtend} />
      <PillButton label="Post an update" onPress={onUpdate} />
    </PillRow>
  ) : (
    <PillRow>
      <PillButton label="Post an update" onPress={onUpdate} />
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
  const toast = useToast();
  const [isDeclining, setIsDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const c = usePageColors();

  async function decline() {
    if (reason.trim() === "") {
      setError("Give a reason so the proposer knows why.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await declineProposal({ taskId, reason });
      toast("Proposal declined");
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
        <PillButton label="Decline" variant="secondary" onPress={() => setIsDeclining(true)} />
        <PillButton label="Review & approve" onPress={onApprove} />
      </PillRow>
    );
  }

  return (
    <View
      style={{
        gap: 14,
        borderRadius: 26,
        backgroundColor: c.panel,
        borderWidth: 1,
        borderColor: c.hairline,
        padding: 18,
      }}
    >
      <Text style={{ fontFamily: fonts.extraBold, fontSize: 17, color: c.text }}>
        Why are you declining it?
      </Text>
      {error !== null ? (
        <Text
          accessibilityRole="alert"
          style={{ fontFamily: fonts.semibold, fontSize: 14, color: c.danger }}
        >
          {error}
        </Text>
      ) : null}
      <TextInput
        accessibilityLabel="Why are you declining it?"
        value={reason}
        onChangeText={setReason}
        placeholder="e.g. Out of scope for v1"
        placeholderTextColor={c.placeholder}
        selectionColor={c.text}
        cursorColor={c.text}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        autoFocus
        className="min-h-24 rounded-2xl border border-border bg-field px-5 py-4 text-base text-field-foreground focus:border-foreground"
      />
      <PillRow>
        <PillButton label="Cancel" variant="secondary" onPress={() => setIsDeclining(false)} />
        <PillButton
          label={isSubmitting ? "Declining…" : "Decline"}
          onPress={decline}
          isLoading={isSubmitting}
        />
      </PillRow>
    </View>
  );
}
