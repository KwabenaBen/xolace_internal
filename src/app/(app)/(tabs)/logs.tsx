import type { JSX } from "react";

import { PlaceholderScreen } from "@/components/placeholder-screen";

export default function LogsScreen(): JSX.Element {
  return (
    <PlaceholderScreen
      title="Logs"
      subtitle="Daily work logs from the team."
      comingIn="Phase 4 — Daily logs"
      description="Weekday logs (what I did, what's next, blockers), optional weekend one-liners and each person's history."
    />
  );
}
