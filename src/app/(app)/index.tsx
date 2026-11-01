import type { JSX } from "react";

import { PlaceholderScreen } from "@/components/placeholder-screen";

export default function BoardScreen(): JSX.Element {
  return (
    <PlaceholderScreen
      title="Board"
      subtitle="Every feature and task, for the whole team."
      comingIn="Phase 2 — Features & tasks"
      description="The shared board with filters by owner, feature and status lands here."
    />
  );
}
