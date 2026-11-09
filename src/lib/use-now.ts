import { useEffect, useState } from "react";

/**
 * The current time, refreshed every `intervalMs` (default: a minute). Use it instead of
 * calling `Date.now()` during render, which React Compiler treats as impure — and so that
 * "Overdue" labels flip on their own while a screen stays open.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
