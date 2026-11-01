import type { JSX } from "react";

import { PlaceholderScreen } from "@/components/placeholder-screen";

export default function MyTasksScreen(): JSX.Element {
  return (
    <PlaceholderScreen
      title="My Tasks"
      subtitle="What you own, what's due and what's waiting on you."
      comingIn="Phase 2 — Features & tasks"
      description="Your tasks, progress updates and deadline extensions will live here (progress and extensions arrive in Phase 3)."
    />
  );
}
