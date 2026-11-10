import { useMutation, useQuery } from "convex/react";
import { useState, type JSX } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import { ActivityRow } from "@/components/activity/activity-row";
import { Panel } from "@/components/ui/panel";
import { Sym, symbols } from "@/components/ui/sym";
import { fonts, usePageColors } from "@/components/ui/theme";
import { getErrorMessage } from "@/lib/errors";
import { useNow } from "@/lib/use-now";

const FIRST = 8;

/**
 * A task's history: everything that happened to it (created, updates, extension requests and
 * decisions, overdue, comments), newest first, with a box to comment at the top. Anyone can
 * comment, except on a declined proposal. Comments can't be edited or deleted.
 */
export function TaskHistory({
  s,
  taskId,
  canComment,
}: {
  s: number;
  taskId: Id<"tasks">;
  canComment: boolean;
}): JSX.Element {
  const c = usePageColors();
  const now = useNow();
  const items = useQuery(api.activity.forTask, { taskId });
  const addComment = useMutation(api.comments.add);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  async function send() {
    if (body.trim() === "" || sending) return;
    setError(null);
    setSending(true);
    try {
      await addComment({ taskId, body });
      setBody("");
    } catch (e) {
      setError(getErrorMessage(e, "Couldn't post your comment. Try again."));
    } finally {
      setSending(false);
    }
  }

  const shown = items === undefined ? [] : showAll ? items : items.slice(0, FIRST);
  const canSend = body.trim() !== "" && !sending;

  return (
    <Panel
      s={s}
      title="Updates and comments"
      aside={
        items !== undefined && items.length > 0 ? (
          <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: c.muted }}>
            {items.length}
          </Text>
        ) : undefined
      }
    >
      {canComment ? (
        <View style={{ gap: 6 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-end",
              gap: 8,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: c.hairline,
              backgroundColor: c.field,
              paddingLeft: 16,
              paddingRight: 6,
              paddingVertical: 6,
            }}
          >
            <TextInput
              accessibilityLabel="Add a comment"
              value={body}
              onChangeText={setBody}
              placeholder="Add a comment"
              placeholderTextColor={c.placeholder}
              selectionColor={c.text}
              cursorColor={c.text}
              multiline
              maxLength={2000}
              style={{
                flex: 1,
                minHeight: 36,
                maxHeight: 140,
                paddingVertical: 8,
                fontFamily: fonts.medium,
                fontSize: 15,
                color: c.fieldText,
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Post comment"
              accessibilityState={{ disabled: !canSend, busy: sending }}
              disabled={!canSend}
              onPress={() => void send()}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 999,
                backgroundColor: c.accent,
                alignItems: "center",
                justifyContent: "center",
                opacity: !canSend ? 0.35 : pressed ? 0.7 : 1,
              })}
            >
              {sending ? (
                <ActivityIndicator color={c.accentText} />
              ) : (
                <Sym symbol={symbols.send} size={16} color={c.accentText} weight="bold" />
              )}
            </Pressable>
          </View>
          {error !== null ? (
            <Text
              accessibilityRole="alert"
              style={{ fontFamily: fonts.semibold, fontSize: 13, color: c.danger }}
            >
              {error}
            </Text>
          ) : null}
        </View>
      ) : null}

      {items === undefined ? (
        <ActivityIndicator color={c.text} />
      ) : items.length === 0 ? (
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: c.muted }}>Nothing yet.</Text>
      ) : (
        <View>
          {shown.map((item) => (
            <ActivityRow key={item._id} item={item} inTask now={now} />
          ))}
          {items.length > FIRST ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowAll((v) => !v)}
              hitSlop={8}
              className="self-start active:opacity-60"
              style={{ paddingTop: 6 }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: c.text }}>
                {showAll ? "Show less" : `Show all ${items.length}`}
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </Panel>
  );
}
