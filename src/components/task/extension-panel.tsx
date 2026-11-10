import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState, type JSX } from "react";
import { Text, TextInput, View } from "react-native";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { longDay, shortDay } from "@convex/lib/dates";
import { isLateExtension } from "@convex/lib/lateRule";

import { PillButton, PillRow } from "@/components/ui/pill-button";
import { colors, fonts, usePageColors } from "@/components/ui/theme";
import { EXTENSION_TYPE_LABELS } from "@/constants/labels";
import { getErrorMessage } from "@/lib/errors";
import { useAnnounce } from "@/lib/use-announce";

import { waitingFor } from "./deciders";

type Extensions = FunctionReturnType<typeof api.extensions.forTask>;
type Request = Extensions["requests"][number];

/**
 * A request for more time that's waiting for a decision, as a peach sticker card on the task
 * page: the date asked for, the type, the reason, what approving would do (count as late, move
 * the feature) and who decides. The decider answers right here: Approve (an optional note) or
 * Decline (a reason, which the owner reads); whoever asked can withdraw it. Key it by the
 * request's id, so a new request starts clean.
 */
export function ExtensionPanel({
  s,
  data,
  pending,
  featureDeadline,
  windowHours,
  now,
  myId,
  alreadyLate,
  approveBlock,
}: {
  s: number;
  data: Extensions;
  /** The request waiting for a decision. */
  pending: Request;
  featureDeadline: number;
  windowHours: number;
  now: number;
  /** The signed-in user: whoever asked can withdraw the request. */
  myId: Id<"users">;
  /** The task already counts as late (that never goes back). */
  alreadyLate: boolean;
  /** Why it can only be declined now (the server refuses approving), or null. */
  approveBlock: string | null;
}): JSX.Element {
  const c = usePageColors();
  const decide = useMutation(api.extensions.decide);
  const withdraw = useMutation(api.extensions.withdraw);
  const [mode, setMode] = useState<"approve" | "decline" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useAnnounce(error);

  const late = isLateExtension({
    type: pending.type,
    requestedAt: pending.requestedAt,
    currentDeadline: pending.currentDeadline,
    // The window in force when they asked, which is what approving applies.
    windowHours: pending.lateWindowHours ?? windowHours,
  });
  const isAsker = pending.requestedBy === myId;
  const movesFeature = pending.requestedDeadline > featureDeadline;
  const who = pending.requester?.name.split(" ")[0] ?? "The owner";
  const until = shortDay(pending.requestedDeadline, now);

  async function run(work: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await work();
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
      setError(`Say why, so ${who} knows.`);
      return;
    }
    void run(() => decide({ requestId: pending._id, approve, note }));
  }

  const ink = colors.ink;
  const line = { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: ink };
  // Ink on the peach sticker (red text there is too faint to read).
  const errorLine =
    error !== null ? (
      <Text accessibilityRole="alert" style={{ ...line, fontFamily: fonts.extraBold }}>
        ⚠ {error}
      </Text>
    ) : null;

  return (
    <View
      style={{
        gap: 12 * s,
        borderRadius: 26 * s,
        backgroundColor: colors.peach,
        padding: 18 * s,
      }}
    >
      <View
        accessible
        accessibilityLabel={`${who} asked for more time, until ${longDay(pending.requestedDeadline)}. ${EXTENSION_TYPE_LABELS[pending.type]}. Reason: ${pending.reason}`}
        style={{ gap: 6 }}
      >
        <Text style={{ fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.6, color: ink }}>
          MORE TIME ASKED FOR
        </Text>
        <Text style={{ fontFamily: fonts.black, fontSize: 26 * s, lineHeight: 30 * s, color: ink }}>
          Until {until}
        </Text>
        <Text style={line}>
          {who} · {EXTENSION_TYPE_LABELS[pending.type]} · asked {shortDay(pending.requestedAt, now)}
        </Text>
        <Text
          selectable
          style={{ ...line, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 }}
        >
          “{pending.reason}”
        </Text>
      </View>

      <View style={{ gap: 4 }}>
        <Text style={line}>
          {alreadyLate
            ? "The task already counts as late; approving doesn't change that."
            : late
              ? "Approving it counts the task as late."
              : "A scope change asked for early: approving keeps the task on time."}
        </Text>
        {movesFeature ? (
          <Text style={line}>
            It&apos;s past the feature&apos;s deadline ({shortDay(featureDeadline, now)}), so
            approving moves the feature too.
          </Text>
        ) : null}
      </View>

      {!data.canDecide ? (
        <View style={{ gap: 10 }}>
          <Text style={{ ...line, fontFamily: fonts.semibold }}>{waitingFor(data.decider)}</Text>
          {errorLine}
          {isAsker ? (
            <PillButton
              label="Withdraw request"
              variant="secondary"
              isLoading={busy}
              onPress={() => void run(() => withdraw({ requestId: pending._id }))}
            />
          ) : null}
        </View>
      ) : mode === null ? (
        <View style={{ gap: 10 }}>
          {approveBlock !== null ? (
            <Text style={{ ...line, fontFamily: fonts.semibold }}>{approveBlock}</Text>
          ) : null}
          {approveBlock !== null ? (
            <PillButton label="Decline" variant="secondary" onPress={() => setMode("decline")} />
          ) : (
            <PillRow>
              <PillButton label="Decline" variant="secondary" onPress={() => setMode("decline")} />
              <PillButton label="Approve" onPress={() => setMode("approve")} />
            </PillRow>
          )}
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Text style={{ fontFamily: fonts.extraBold, fontSize: 16, color: ink }}>
            {mode === "approve" ? `Move it to ${until}?` : `Tell ${who} why not`}
          </Text>
          {errorLine}
          <TextInput
            accessibilityLabel={mode === "approve" ? "Note (optional)" : `Tell ${who} why not`}
            value={note}
            onChangeText={setNote}
            placeholder={
              mode === "approve" ? "A note for them (optional)" : "e.g. The launch date is fixed"
            }
            placeholderTextColor={c.placeholder}
            selectionColor={c.text}
            cursorColor={c.text}
            multiline
            maxLength={1000}
            textAlignVertical="top"
            autoFocus={mode === "decline"}
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
              label={mode === "approve" ? "Approve" : "Decline"}
              isLoading={busy}
              onPress={() => send(mode === "approve")}
            />
          </PillRow>
        </View>
      )}
    </View>
  );
}
