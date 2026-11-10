import { Ionicons } from "@expo/vector-icons";
import { Button, Typography, useThemeColor } from "heroui-native";
import { useEffect, useState, type JSX, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FormError } from "@/components/planning/form-error";
import { Sheet, useSheet } from "@/components/ui/sheet";
import { getErrorMessage } from "@/lib/errors";

type RuleSheetProps = {
  title: string;
  /** What the rule does, under the title. */
  note: string;
  /** The picker. Put a scrolling list in a SheetScrollView, a wheel in a SheetNoSwipe. */
  children: ReactNode;
  /** Under the picker, e.g. what the choice means or a warning. */
  footer?: ReactNode;
  /** False while the choice is still the saved value: Save just closes. */
  isChanged: boolean;
  /** The button's label, e.g. "Make Ama the reviewer" (default "Save"). */
  saveLabel?: string;
  onSave: () => Promise<void>;
  onClose: () => void;
};

/**
 * Changing one team rule (Team rules, and the time rows on Settings): a Sheet over the blurred
 * page with the rule, what it does, a picker and Save. Nothing changes until Save; swipe down,
 * ✕ or a tap outside leaves the rule as it was. Locked while saving; an error keeps it open.
 */
export function RuleSheet({ onClose, ...props }: RuleSheetProps): JSX.Element {
  return (
    <Sheet onClose={onClose}>
      <RuleSheetBody {...props} />
    </Sheet>
  );
}

function RuleSheetBody({
  title,
  note,
  children,
  footer,
  isChanged,
  saveLabel = "Save",
  onSave,
}: Omit<RuleSheetProps, "onClose">): JSX.Element {
  const insets = useSafeAreaInsets();
  const [muted] = useThemeColor(["muted"]);
  const sheet = useSheet();
  const { close, setLocked } = sheet;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // No swiping it away while the change is saving.
  useEffect(() => setLocked(busy), [busy, setLocked]);

  async function save() {
    if (!isChanged) {
      close();
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
          <Typography type="body-sm" color="muted">
            {note}
          </Typography>
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
