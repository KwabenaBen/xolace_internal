import { Ionicons } from "@expo/vector-icons";
import { Button, Typography, useThemeColor } from "heroui-native";
import { useEffect, useState, type JSX, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FormError } from "@/components/planning/form-error";
import { Sheet, useSheet } from "@/components/ui/sheet";
import { colors, fonts, usePageColors } from "@/components/ui/theme";
import { getErrorMessage } from "@/lib/errors";

type SaveSheetProps = {
  title: string;
  /** What it's for, under the title. */
  note?: string;
  /** The fields. Put a scrolling list in a SheetScrollView, a dragged control in a SheetNoSwipe. */
  children: ReactNode;
  /** Under the fields, e.g. what the choice means or a warning. */
  footer?: ReactNode;
  /** False while nothing has been changed: the button says Done and just closes. */
  isChanged: boolean;
  /** Why it can't be saved yet (e.g. "Say why"), shown instead of saving. */
  problem?: string | null;
  /** The button's label, e.g. "Post update" (default "Save"). */
  saveLabel?: string;
  onSave: () => Promise<void>;
  onClose: () => void;
};

/**
 * A card for changing one thing (a team rule, a task's progress, an extension request): a Sheet
 * over the blurred page with a title, what it's for, the fields and a Save button. Nothing changes
 * until Save; swipe down, ✕ or a tap outside leaves things as they were. Locked while saving; an
 * error keeps it open with the message.
 */
export function SaveSheet({ onClose, ...props }: SaveSheetProps): JSX.Element {
  return (
    <Sheet onClose={onClose}>
      <SaveSheetBody {...props} />
    </Sheet>
  );
}

function SaveSheetBody({
  title,
  note,
  children,
  footer,
  isChanged,
  problem,
  saveLabel = "Save",
  onSave,
}: Omit<SaveSheetProps, "onClose">): JSX.Element {
  const insets = useSafeAreaInsets();
  const [muted] = useThemeColor(["muted"]);
  const sheet = useSheet();
  const { close, setLocked } = sheet;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // No swiping it away while saving.
  useEffect(() => setLocked(busy), [busy, setLocked]);

  async function save() {
    if (!isChanged) {
      close();
      return;
    }
    if (problem !== undefined && problem !== null) {
      setError(problem);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onSave();
      setBusy(false);
      close();
    } catch (e) {
      setError(getErrorMessage(e));
      setBusy(false);
    }
  }

  return (
    <View style={{ flexShrink: 1, paddingBottom: insets.bottom + 12 }}>
      <View className="flex-row items-start justify-between gap-3 px-5 pb-1 pt-7">
        <View className="flex-1 gap-1">
          <Typography type="h6" accessibilityRole="header">
            {title}
          </Typography>
          {note !== undefined ? (
            <Typography type="body-sm" color="muted">
              {note}
            </Typography>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={12}
          disabled={busy}
          onPress={close}
        >
          <Ionicons name="close" size={22} color={muted} />
        </Pressable>
      </View>

      <View style={{ flexShrink: 1 }}>{children}</View>

      <View className="gap-3 px-5 pt-2">
        {footer}
        <FormError message={error} />
        <Button variant="primary" isDisabled={busy} onPress={() => void save()}>
          {busy ? "Saving…" : isChanged ? saveLabel : "Done"}
        </Button>
      </View>
    </View>
  );
}

/** A note with a yellow dot: something worth knowing before saving (e.g. "This counts as late"). */
export function WarningNote({ text }: { text: string }): JSX.Element {
  const c = usePageColors();
  return (
    <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
      <View
        style={{
          width: 10,
          height: 10,
          marginTop: 5,
          borderRadius: 999,
          backgroundColor: colors.yellow,
        }}
      />
      <Text
        style={{ flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: c.text }}
      >
        {text}
      </Text>
    </View>
  );
}
