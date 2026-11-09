import { Ionicons } from "@expo/vector-icons";
import { Button, Typography, useThemeColor } from "heroui-native";
import { useEffect, type JSX, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FormError } from "@/components/planning/form-error";

import { Sheet, SheetScrollView, useSheet } from "./sheet";
import { useSheetActions, type SheetAction } from "./use-sheet-actions";

export type { SheetAction } from "./use-sheet-actions";

type ActionSheetProps = {
  title: string;
  subtitle?: string;
  /** Shown under the title while the actions are listed (e.g. an invite's code). */
  detail?: ReactNode;
  actions: readonly SheetAction[];
  onClose: () => void;
};

/**
 * A sheet of actions on one thing (e.g. an invite): a Sheet (rises over the blurred page, swipe
 * down to close) with a list of actions. Confirmations happen inside the sheet, not as an alert
 * on top of it, since iOS won't show an alert over a modal that's closing. Mount it to open it.
 */
export function ActionSheet({ onClose, ...props }: ActionSheetProps): JSX.Element {
  return (
    <Sheet onClose={onClose}>
      <ActionSheetBody {...props} />
    </Sheet>
  );
}

function ActionSheetBody({
  title,
  subtitle,
  detail,
  actions,
}: Omit<ActionSheetProps, "onClose">): JSX.Element {
  const insets = useSafeAreaInsets();
  const [muted, danger] = useThemeColor(["muted", "danger"]);
  const sheet = useSheet();
  const { asking, busy, error, choose, run, back, close } = useSheetActions(sheet.close);
  const { setLocked } = sheet;

  // No swiping it away while an action is saving.
  useEffect(() => setLocked(busy), [busy, setLocked]);

  return (
    <View style={{ flexShrink: 1, paddingBottom: insets.bottom + 8 }}>
      <View className="flex-row items-start justify-between gap-3 px-5 pb-2 pt-7">
        <View className="flex-1 gap-0.5">
          <Typography type="h6" accessibilityRole="header">
            {asking?.confirm?.title ?? title}
          </Typography>
          {asking === null && subtitle !== undefined ? (
            <Typography type="body-sm" color="muted">
              {subtitle}
            </Typography>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={12}
          onPress={close}
        >
          <Ionicons name="close" size={22} color={muted} />
        </Pressable>
      </View>

      {asking?.confirm !== undefined ? (
        <View className="gap-4 px-5 pb-3 pt-1">
          <Typography type="body" color="muted">
            {asking.confirm.message}
          </Typography>
          <FormError message={error} />
          <View className="gap-2">
            <Button
              variant={asking.destructive === true ? "danger" : "primary"}
              isDisabled={busy}
              onPress={() => run(asking)}
            >
              {busy ? "Working…" : asking.confirm.label}
            </Button>
            <Button variant="secondary" isDisabled={busy} onPress={back}>
              Not now
            </Button>
          </View>
        </View>
      ) : (
        <SheetScrollView contentContainerClassName="gap-2 px-2 pb-2">
          {detail !== undefined ? <View className="px-3 pb-1">{detail}</View> : null}
          {error !== null ? (
            <View className="px-3">
              <FormError message={error} />
            </View>
          ) : null}
          {actions.map((action) => (
            <Pressable
              key={action.key}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              accessibilityHint={action.description}
              disabled={busy}
              onPress={() => choose(action)}
              className="flex-row items-center gap-3 rounded-xl px-3 py-3 active:bg-default"
            >
              <View className="flex-1 gap-0.5">
                <Typography
                  type="body"
                  weight="semibold"
                  style={action.destructive === true ? { color: danger } : undefined}
                >
                  {action.label}
                </Typography>
                {action.description !== undefined ? (
                  <Typography type="body-xs" color="muted">
                    {action.description}
                  </Typography>
                ) : null}
              </View>
            </Pressable>
          ))}
        </SheetScrollView>
      )}
    </View>
  );
}
