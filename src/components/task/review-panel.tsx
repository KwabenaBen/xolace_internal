import { useMutation } from "convex/react";
import { useState, type JSX, type ReactNode } from "react";
import { Linking, Pressable, Text, TextInput, View } from "react-native";

import { api } from "@convex/_generated/api";
import { REVIEW_LIMITS } from "@convex/lib/constants";
import { longDay, shortDay } from "@convex/lib/dates";
import { isOwnerWorking } from "@convex/lib/validators";
import type { TaskView } from "@convex/lib/views";

import { PillButton, PillRow } from "@/components/ui/pill-button";
import { Sym, symbols } from "@/components/ui/sym";
import { colors, fonts, usePageColors } from "@/components/ui/theme";
import { useToast } from "@/components/ui/toast";
import { getErrorMessage } from "@/lib/errors";
import { useAnnounce } from "@/lib/use-announce";

import type { TaskReviews } from "./use-task-state";
import { waitingToVerify } from "./verifiers";

type Review = TaskReviews["history"][number];

/**
 * A task's review, as a sticker card on its page (phone and website): the request waiting for a
 * decision (sky for a peer review, lavender for verification) with what was said and the proof
 * link, and the decision right there for whoever makes it (the peer reviewer: approve or send back
 * with comments; a verifier: tick each acceptance criterion, then verify or ask for changes). The
 * owner can take it back. With nothing waiting it shows the last outcome that still matters: the
 * changes asked for (yellow, until the owner sends it again, whatever updates they post), the
 * code approved and ready to submit, or, once verified, who verified it and the proof that was
 * accepted. Key it by the pending request's id, so a new one starts clean. Null when there's
 * nothing to show.
 */
export function ReviewPanel({
  s,
  task,
  reviews,
  now,
}: {
  s: number;
  task: TaskView;
  reviews: TaskReviews;
  now: number;
}): JSX.Element | null {
  const pending = reviews.pending;
  if (pending !== null) {
    return <PendingCard s={s} task={task} reviews={reviews} pending={pending} now={now} />;
  }
  const last = reviews.history.find((row) => row.decision !== undefined);
  if (last === undefined) return null;
  if (task.status === "verified") {
    return last.stage === "verification" && last.decision === "approved" ? (
      <VerifiedCard s={s} review={last} now={now} />
    ) : null;
  }
  if (last.decision === "changes_requested" && isOwnerWorking(task.status)) {
    return <ChangesCard s={s} task={task} review={last} now={now} />;
  }
  if (
    task.kind === "code" &&
    !reviews.needsPeerReview &&
    last.stage === "peer_review" &&
    last.decision === "approved"
  ) {
    return (
      <Card s={s} fill={colors.sky}>
        <Eyebrow text="CODE APPROVED" />
        <Text style={inkLine}>
          {last.reviewer?.name ?? "The peer reviewer"} approved the code
          {last.decidedAt !== undefined ? ` on ${shortDay(last.decidedAt, now)}` : ""}.{" "}
          {task.status === "blocked"
            ? "Unblock it (Post an update), then submit it for verification."
            : "Next: submit it for verification."}
        </Text>
        {last.reason ? <Quote text={last.reason} /> : null}
        {last.proofUrl !== undefined ? <ProofLink url={last.proofUrl} /> : null}
      </Card>
    );
  }
  return null;
}

/** Once verified: who verified it and when, what the owner said, and the proof accepted. */
function VerifiedCard({ s, review, now }: { s: number; review: Review; now: number }): JSX.Element {
  return (
    <Card s={s} fill={colors.green}>
      <Eyebrow text="VERIFIED" />
      <Text style={inkLine}>
        {review.reviewer !== null ? `Verified by ${review.reviewer.name}` : "Verified"}
        {review.decidedAt !== undefined ? ` · ${shortDay(review.decidedAt, now)}` : ""}
        {review.submitter !== null ? ` · submitted by ${review.submitter.name}` : ""}
      </Text>
      {review.note !== "" ? <Quote text={review.note} /> : null}
      {review.proofUrl !== undefined ? <ProofLink url={review.proofUrl} /> : null}
      {review.reason ? (
        <Text style={inkLine}>
          <Text style={{ fontFamily: fonts.bold }}>Verifier&apos;s note: </Text>
          {review.reason}
        </Text>
      ) : null}
    </Card>
  );
}

const inkLine = { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.ink };

function Card({
  s,
  fill,
  children,
}: {
  s: number;
  fill: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <View
      style={{
        gap: 12 * s,
        borderRadius: 26 * s,
        backgroundColor: fill,
        borderWidth: 1.5,
        borderColor: colors.ink,
        padding: 18 * s,
      }}
    >
      {children}
    </View>
  );
}

function Eyebrow({ text }: { text: string }): JSX.Element {
  return (
    <Text style={{ fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.6, color: colors.ink }}>
      {text}
    </Text>
  );
}

function Quote({ text }: { text: string }): JSX.Element {
  return (
    <Text
      selectable
      style={{ ...inkLine, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 }}
    >
      “{text}”
    </Text>
  );
}

/**
 * The proof link: opens it in the browser. The server only stores plain http(s) links
 * (cleanProofUrl); anything else (a row edited by hand) isn't opened.
 */
function ProofLink({ url }: { url: string }): JSX.Element {
  const open = () => {
    if (!/^https?:\/\//i.test(url)) return;
    Linking.openURL(url).catch(() => undefined);
  };
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Open the link: ${url}`}
      onPress={open}
      className="active:opacity-60"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        alignSelf: "flex-start",
        maxWidth: "100%",
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 7,
        backgroundColor: colors.tagFill,
        borderWidth: 1,
        borderColor: colors.ink,
      }}
    >
      <Sym symbol={symbols.arrowUpRight} size={13} color={colors.ink} weight="semibold" />
      <Text
        numberOfLines={1}
        style={{ flexShrink: 1, fontFamily: fonts.semibold, fontSize: 13, color: colors.ink }}
      >
        {url.replace(/^https?:\/\//i, "")}
      </Text>
    </Pressable>
  );
}

/** The changes asked for (by the peer reviewer or a verifier), until the owner sends it again. */
function ChangesCard({
  s,
  task,
  review,
  now,
}: {
  s: number;
  task: TaskView;
  review: Review;
  now: number;
}): JSX.Element {
  // The criteria as they were when ticked (the plan can change once it's sent back); older rows
  // without them are read against today's, only while the count still matches.
  const criteria =
    review.criteria ??
    (task.acceptanceCriteria.length === review.criteriaMet?.length ? task.acceptanceCriteria : []);
  const missed = criteria.filter((_, i) => review.criteriaMet?.[i] === false);
  const who = review.reviewer?.name ?? "The reviewer";
  return (
    <Card s={s} fill={colors.yellow}>
      <Eyebrow
        text={review.stage === "peer_review" ? "SENT BACK FROM PEER REVIEW" : "CHANGES ASKED FOR"}
      />
      <Text style={inkLine}>
        {who}
        {review.decidedAt !== undefined ? ` · ${shortDay(review.decidedAt, now)}` : ""}
        {review.stage === "peer_review"
          ? " · it goes through peer review again"
          : task.kind === "code"
            ? " · it goes back through peer review"
            : " · fix it, then submit it again"}
      </Text>
      {review.reason ? <Quote text={review.reason} /> : null}
      {missed.length > 0 ? (
        <View style={{ gap: 4 }}>
          <Text style={{ ...inkLine, fontFamily: fonts.bold }}>Not met yet:</Text>
          {missed.map((criterion, i) => (
            <Text key={i} style={inkLine}>
              • {criterion}
            </Text>
          ))}
        </View>
      ) : null}
      {review.proofUrl !== undefined ? <ProofLink url={review.proofUrl} /> : null}
    </Card>
  );
}

/** The request waiting for a decision, with the decision for whoever makes it. */
function PendingCard({
  s,
  task,
  reviews,
  pending,
  now,
}: {
  s: number;
  task: TaskView;
  reviews: TaskReviews;
  pending: Review;
  now: number;
}): JSX.Element {
  const c = usePageColors();
  const decidePeerReview = useMutation(api.reviews.decidePeerReview);
  const verify = useMutation(api.reviews.verify);
  const withdraw = useMutation(api.reviews.withdraw);
  const toast = useToast();
  const [mode, setMode] = useState<"approve" | "changes" | null>(null);
  const [note, setNote] = useState("");
  const [ticks, setTicks] = useState<boolean[]>(() => task.acceptanceCriteria.map(() => false));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useAnnounce(error);

  const peer = pending.stage === "peer_review";
  const who = pending.submitter?.name.split(" ")[0] ?? "The owner";
  const reviewerName = task.peerReviewer?.name;
  const canDecide = peer ? reviews.canDecidePeerReview : reviews.canVerify;
  const allTicked = ticks.every(Boolean);
  // Nobody can decide a peer review whose reviewer has left; the owner's way out is Take it back.
  const reviewerGone = peer && task.peerReviewer?.isActive === false;
  const title = canDecide
    ? peer
      ? "Yours to review"
      : "Yours to verify"
    : peer
      ? reviewerName !== undefined
        ? `Waiting on ${reviewerName.split(" ")[0]}`
        : "Waiting for its peer reviewer"
      : "Waiting to be verified";
  const waitingLine = reviewerGone
    ? reviews.canWithdraw
      ? `${reviewerName ?? "The peer reviewer"} has been deactivated, so nobody can review it. Take it back, then ask an admin to choose another peer reviewer.`
      : `${reviewerName ?? "The peer reviewer"} has been deactivated: ${who} can take it back, and an admin can then choose another peer reviewer.`
    : peer
      ? `Waiting for ${reviewerName ?? "the peer reviewer"} to review the code.`
      : waitingToVerify(reviews.verifier);

  async function run(work: () => Promise<unknown>, done: string) {
    setError(null);
    setBusy(true);
    try {
      await work();
      toast(done);
      setMode(null);
      setNote("");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function send(approve: boolean) {
    if (!approve && note.trim() === "") {
      setError(`Say what needs changing, so ${who} knows.`);
      return;
    }
    if (peer) {
      void run(
        () =>
          decidePeerReview({
            taskId: task._id,
            decision: approve ? "approved" : "changes_requested",
            note,
          }),
        approve ? "Code approved" : "Sent back with comments"
      );
      return;
    }
    if (approve && !allTicked) {
      setError("Tick every acceptance criterion to verify it, or ask for changes.");
      return;
    }
    void run(
      () =>
        verify({
          taskId: task._id,
          decision: approve ? "approved" : "changes_requested",
          criteriaMet: ticks,
          note,
        }),
      approve ? "Task verified" : "Changes asked for"
    );
  }

  const errorLine =
    error !== null ? (
      <Text accessibilityRole="alert" style={{ ...inkLine, fontFamily: fonts.extraBold }}>
        ⚠ {error}
      </Text>
    ) : null;

  return (
    <Card s={s} fill={peer ? colors.sky : colors.lavender}>
      <View
        accessible
        accessibilityLabel={`${peer ? "Peer review asked for" : "Submitted for verification"} by ${who}, ${longDay(pending._creationTime)}.${pending.note ? ` ${pending.note}` : ""}`}
        style={{ gap: 6 }}
      >
        <Eyebrow text={peer ? "PEER REVIEW" : "SUBMITTED FOR VERIFICATION"} />
        <Text
          style={{
            fontFamily: fonts.black,
            fontSize: 24 * s,
            lineHeight: 28 * s,
            color: colors.ink,
          }}
        >
          {title}
        </Text>
        <Text style={inkLine}>
          {who} · {peer ? "asked" : "submitted"} {shortDay(pending._creationTime, now)}
        </Text>
        {pending.note !== "" ? <Quote text={pending.note} /> : null}
      </View>
      {pending.proofUrl !== undefined ? <ProofLink url={pending.proofUrl} /> : null}

      {!peer && canDecide ? (
        <View style={{ gap: 8 }}>
          <Text style={{ ...inkLine, fontFamily: fonts.bold }}>
            Check each acceptance criterion
          </Text>
          {task.acceptanceCriteria.map((criterion, i) => {
            const on = ticks[i];
            return (
              <Pressable
                key={`${i}-${criterion}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                aria-checked={on}
                accessibilityLabel={criterion}
                onPress={() => setTicks((t) => t.map((v, j) => (j === i ? !v : v)))}
                className="active:opacity-70"
                style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 7,
                    borderWidth: 1.5,
                    borderColor: colors.ink,
                    backgroundColor: on ? colors.ink : colors.tagFill,
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 1,
                  }}
                >
                  {on ? (
                    <Sym symbol={symbols.check} size={13} color={colors.white} weight="bold" />
                  ) : null}
                </View>
                <Text style={{ ...inkLine, flex: 1, fontSize: 15, lineHeight: 22 }}>
                  {criterion}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {!canDecide ? (
        <View style={{ gap: 10 }}>
          <Text style={{ ...inkLine, fontFamily: fonts.semibold }}>{waitingLine}</Text>
          {errorLine}
          {reviews.canWithdraw ? (
            <PillButton
              label="Take it back"
              variant="secondary"
              isLoading={busy}
              onPress={() => void run(() => withdraw({ taskId: task._id }), "Taken back")}
            />
          ) : null}
        </View>
      ) : mode === null ? (
        <View style={{ gap: 10 }}>
          {errorLine}
          <PillRow>
            <PillButton
              label={peer ? "Send back" : "Ask for changes"}
              variant="secondary"
              onPress={() => setMode("changes")}
            />
            <PillButton
              label={peer ? "Approve" : "Verify"}
              isDisabled={!peer && !allTicked}
              onPress={() => setMode("approve")}
            />
          </PillRow>
          {!peer && !allTicked ? (
            <Text style={{ ...inkLine, fontSize: 13 }}>Verify once every criterion is ticked.</Text>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Text style={{ fontFamily: fonts.extraBold, fontSize: 16, color: colors.ink }}>
            {mode === "approve"
              ? peer
                ? "Approve the code?"
                : "Verify it?"
              : `Tell ${who} what needs changing`}
          </Text>
          {mode === "changes" && !peer ? (
            <Text style={{ ...inkLine, fontSize: 13 }}>
              Tick the criteria that are met above, so {who} sees what&apos;s left.
            </Text>
          ) : null}
          {errorLine}
          <TextInput
            accessibilityLabel={mode === "approve" ? "Note (optional)" : "What needs changing"}
            value={note}
            onChangeText={setNote}
            placeholder={
              mode === "approve"
                ? "A note (optional)"
                : peer
                  ? "e.g. The right code is rejected too"
                  : "e.g. The second criterion isn't met yet"
            }
            placeholderTextColor={c.placeholder}
            selectionColor={c.text}
            cursorColor={c.text}
            multiline
            maxLength={REVIEW_LIMITS.note}
            textAlignVertical="top"
            autoFocus={mode === "changes"}
            className="min-h-20 rounded-2xl border border-border bg-field px-4 py-3 text-base text-field-foreground focus:border-foreground"
          />
          <PillRow>
            <PillButton
              label="Cancel"
              variant="secondary"
              isDisabled={busy}
              onPress={() => {
                setMode(null);
                setNote("");
                setError(null);
              }}
            />
            <PillButton
              label={
                mode === "approve"
                  ? peer
                    ? "Approve"
                    : "Verify"
                  : peer
                    ? "Send back"
                    : "Ask for changes"
              }
              isLoading={busy}
              onPress={() => send(mode === "approve")}
            />
          </PillRow>
        </View>
      )}
    </Card>
  );
}
