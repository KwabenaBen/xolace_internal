/**
 * Copies text to the clipboard on the web (the phone shares through its share sheet instead).
 * Uses the browser's own clipboard, so no package is needed. True when it worked.
 */
export async function copyText(text: string): Promise<boolean> {
  const clipboard = (
    globalThis as { navigator?: { clipboard?: { writeText(value: string): Promise<void> } } }
  ).navigator?.clipboard;
  if (clipboard === undefined) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
