import { useMutation } from "convex/react";
import { Typography } from "heroui-native";
import { useState, type JSX } from "react";
import { TextInput, View } from "react-native";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { REVIEW_LIMITS } from "@convex/lib/constants";

import { SaveSheet } from "@/components/ui/save-sheet";
import { SheetScrollView } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { usePageColors } from "@/components/ui/theme";

/** A proof link as typed: empty, or something that looks like a web address. */
function linkProblem(link: string): string | null {
  const url = link.trim();
  if (url === "") return null;
  return /^https?:\/\/\S+$/i.test(url) ? null : "The link must start with https:// (or http://).";
}

/**
 * The owner's request, in a card over the page: ask the peer reviewer to review a code task
 * (`peer`: a note and a link, both optional), or submit a task for verification (`submit`: a note,
 * needed, and a link as proof, optional: a PR, a build, a page). Links only for now. Submitting
 * sets progress to 100% (reviews.submit), and the card says so.
 */
export function ReviewSheet({
  mode,
  taskId,
  reviewerName,
  verifierWords,
  onClose,
}: {
  mode: "peer" | "submit";
  taskId: Id<"tasks">;
  /** The peer reviewer's name (asking for a peer review). */
  reviewerName?: string;
  /** Who verifies it, in words (submitting): "An admin verifies it." */
  verifierWords?: string;
  onClose: () => void;
}): JSX.Element {
  const c = usePageColors();
  const requestPeerReview = useMutation(api.reviews.requestPeerReview);
  const submit = useMutation(api.reviews.submit);
  const toast = useToast();
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const peer = mode === "peer";
  const problem =
    linkProblem(link) ??
    (!peer && note.trim() === "" ? "Say what's done, for the verifier." : null);

  const field =
    "rounded-2xl border border-border bg-field px-4 py-3 text-base text-field-foreground focus:border-foreground";

  return (
    <SaveSheet
      title={peer ? "Ask for a peer review" : "Submit for verification"}
      note={
        peer
          ? `${reviewerName ?? "The peer reviewer"} reviews the code, then approves it or sends it back with comments.`
          : `${verifierWords ?? "An admin verifies it."} They check each acceptance criterion. Submitting marks it 100% done.`
      }
      // Always sendable once it's valid (a peer review needs nothing typed).
      isChanged
      problem={problem}
      saveLabel={peer ? "Ask for review" : "Submit"}
      onSave={async () => {
        if (peer) {
          await requestPeerReview({ taskId, note, proofUrl: link });
          toast("Sent for peer review");
        } else {
          await submit({ taskId, note, proofUrl: link });
          toast("Submitted for verification");
        }
      }}
      onClose={onClose}
    >
      <SheetScrollView
        contentContainerStyle={{ gap: 18, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 }}
      >
        <View style={{ gap: 6 }}>
          <Typography type="body-sm" weight="medium">
            {peer ? "What to look at (optional)" : "What's done"}
          </Typography>
          <TextInput
            accessibilityLabel={peer ? "What to look at" : "What's done"}
            value={note}
            onChangeText={setNote}
            placeholder={
              peer
                ? "e.g. The error paths in the invite check"
                : "e.g. Both cases work and are tested"
            }
            placeholderTextColor={c.placeholder}
            selectionColor={c.text}
            cursorColor={c.text}
            multiline
            maxLength={REVIEW_LIMITS.note}
            textAlignVertical="top"
            className={`min-h-20 ${field}`}
          />
        </View>
        <View style={{ gap: 6 }}>
          <Typography type="body-sm" weight="medium">
            {peer ? "Link (optional)" : "Proof (optional)"}
          </Typography>
          <TextInput
            accessibilityLabel={peer ? "Link" : "Proof link"}
            value={link}
            onChangeText={setLink}
            placeholder="https://… a PR, a build or a page"
            placeholderTextColor={c.placeholder}
            selectionColor={c.text}
            cursorColor={c.text}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            maxLength={REVIEW_LIMITS.url}
            className={field}
          />
        </View>
      </SheetScrollView>
    </SaveSheet>
  );
}
