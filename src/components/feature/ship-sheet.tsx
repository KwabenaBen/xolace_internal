import { useMutation } from "convex/react";
import type { JSX } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import { ActionSheet } from "@/components/ui/action-sheet";
import { useToast } from "@/components/ui/toast";

/**
 * "Mark as live" for an admin, once every task in a feature is verified (Internal testing): a
 * card that asks first (shipping is for good: a shipped feature takes no new work), then marks it
 * Shipped (features.markShipped). Phone and website alike.
 */
export function ShipSheet({
  featureId,
  title,
  onClose,
}: {
  featureId: Id<"features">;
  title: string;
  onClose: () => void;
}): JSX.Element {
  const markShipped = useMutation(api.features.markShipped);
  const toast = useToast();
  return (
    <ActionSheet
      title={title}
      subtitle="Every task is verified."
      actions={[
        {
          key: "ship",
          label: "Mark as live",
          description: "It moves to Shipped and takes no new tasks.",
          confirm: {
            title: "Mark it as live?",
            message: `${title} moves to Shipped. Shipped features take no new tasks or proposals, and this can't be undone.`,
            label: "Mark as live",
          },
          run: async () => {
            await markShipped({ featureId });
            toast("Feature is live");
          },
        },
      ]}
      onClose={onClose}
    />
  );
}
