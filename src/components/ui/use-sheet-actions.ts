import { useState } from "react";

import { getErrorMessage } from "@/lib/errors";

export type SheetAction = {
  key: string;
  label: string;
  /** A line under the label: what the action does. */
  description?: string;
  destructive?: boolean;
  /** Asks first, inside the sheet: a question, what will happen, and the button's label. */
  confirm?: { title: string; message: string; label: string };
  /** The work. Errors it throws are shown in the sheet, which then stays open. */
  run: () => Promise<void>;
  /** Back to the options afterwards instead of closing (e.g. New code, to share the new one). */
  stayOpen?: boolean;
};

/**
 * The state behind a sheet of actions (ActionSheet, a person's card): which action is asking
 * "are you sure?", whether one is running, and the error from the last one. Confirmations happen
 * inside the sheet, since iOS won't show an alert over a modal that's closing.
 */
export function useSheetActions(onClose: () => void): {
  asking: SheetAction | null;
  busy: boolean;
  error: string | null;
  /** Tap on an action: ask first if it needs it, else run it. */
  choose: (action: SheetAction) => void;
  /** Run an action (after its confirmation). */
  run: (action: SheetAction) => Promise<void>;
  /** "Not now": back to the options. */
  back: () => void;
  /** Close the sheet (not while an action is running). */
  close: () => void;
} {
  const [asking, setAsking] = useState<SheetAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: SheetAction) {
    setError(null);
    setBusy(true);
    try {
      await action.run();
      setAsking(null);
      setBusy(false);
      if (action.stayOpen !== true) onClose();
    } catch (e) {
      setError(getErrorMessage(e));
      setBusy(false);
    }
  }

  return {
    asking,
    busy,
    error,
    choose: (action) => {
      setError(null);
      if (action.confirm !== undefined) setAsking(action);
      else void run(action);
    },
    run,
    back: () => {
      setAsking(null);
      setError(null);
    },
    close: () => {
      if (busy) return;
      setAsking(null);
      setError(null);
      onClose();
    },
  };
}
