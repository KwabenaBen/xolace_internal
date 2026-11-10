import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState, type JSX } from "react";
import { Text, TextInput, View } from "react-native";

import { api } from "@convex/_generated/api";
import { longDay, shortDay } from "@convex/lib/dates";
import { isLateExtension } from "@convex/lib/lateRule";

import { PillButton, PillRow } from "@/components/ui/pill-button";
import { colors, fonts, usePageColors } from "@/components/ui/theme";
import { EXTENSION_TYPE_LABELS } from "@/constants/labels";
import { getErrorMessage } from "@/lib/errors";

type Extensions = FunctionReturnType<typeof api.extensions.forTask>;

/**
 * A request for more time that's waiting for a decision, as a peach sticker card on the task
 * page: the date asked for, the type, the reason, what approving would do (count as late, move
 * the feature) and who decides. The decider answers right here: Approve (an optional note) or
 * Decline (a reason, which the owner reads). Nothing when no request is waiting.
 */
export function ExtensionPanel({
  s,
  data,
  featureDeadline,
  windowHours,
  now,
}: {
  s: number;
  data: Extensions;
  featureDeadline: number;
  windowHours: number;
  now: number;
}): JSX.Element | null {
  const c = usePageColors();
  const decide = useMutation(api.extensions.decide);
  const [mode, setMode] = useState<"approve" | "decline" | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pending = data.requests.find((r) => r.status === "pending");
  if (pending === undefined) return null;

  const late = isLateExtension({
    type: pending.type,
    requestedAt: pending.requestedAt,
    currentDeadline: pending.currentDeadline,
    windowHours,
  });
  const movesFeature = pending.requestedDeadline > featureDeadline;
  const who = pending.requester?.name.split(" ")[0] ?? "The owner";
  const until = shortDay(pending.requestedDeadline, now);
  const waitingFor =
    data.decider.kind === "admins"
      ? "Waiting for an admin to decide."
      : data.decider.name !== null
        ? `Waiting for ${data.decider.name}, the admin task reviewer, to decide.`
        : "Nobody can decide it yet: an admin needs to choose the admin task reviewer in Team rules.";

  async function send(approve: boolean) {
    if (!approve && note.trim() === "") {
      setError(`Say why, so ${who} knows.`);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await decide({ requestId: pending!._id, approve, note });
      setMode(null);
      setNote("");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const ink = colors.ink;
  const line = { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: ink };

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
          {late
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
        <Text style={{ ...line, fontFamily: fonts.semibold }}>{waitingFor}</Text>
      ) : mode === null ? (
        <PillRow>
          <PillButton label="Decline" variant="secondary" onPress={() => setMode("decline")} />
          <PillButton label="Approve" onPress={() => setMode("approve")} />
        </PillRow>
      ) : (
        <View style={{ gap: 10 }}>
          <Text style={{ fontFamily: fonts.extraBold, fontSize: 16, color: ink }}>
            {mode === "approve" ? `Move it to ${until}?` : `Why not, ${who}?`}
          </Text>
          {error !== null ? (
            <Text
              accessibilityRole="alert"
              style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.lateCard }}
            >
              {error}
            </Text>
          ) : null}
          <TextInput
            accessibilityLabel={mode === "approve" ? "Note (optional)" : "Why not"}
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
              onPress={() => void send(mode === "approve")}
            />
          </PillRow>
        </View>
      )}
    </View>
  );
}
