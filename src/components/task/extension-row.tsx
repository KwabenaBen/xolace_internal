import type { FunctionReturnType } from "convex/server";
import type { JSX } from "react";

import type { api } from "@convex/_generated/api";
import { shortDay } from "@convex/lib/dates";

import { Avatar, pastelFor } from "@/components/people/avatar";
import { ListRow } from "@/components/people/list-row";
import { colors } from "@/components/ui/theme";
import { EXTENSION_TYPE_LABELS } from "@/constants/labels";

export type PendingExtension = FunctionReturnType<typeof api.extensions.pending>[number];

/**
 * A request for more time waiting for a decision, as a row: who asked (their avatar), the task,
 * the date asked for and the type, and a yellow dot when it's yours to decide. Tapping opens the
 * task, where it's decided.
 */
export function ExtensionRow({
  s,
  item,
  now,
  onPress,
}: {
  s: number;
  item: PendingExtension;
  now: number;
  onPress: () => void;
}): JSX.Element {
  const { request, task, feature, canDecide } = item;
  const who = request.requester?.name.split(" ")[0] ?? "Someone";
  const until = shortDay(request.requestedDeadline, now);
  const type = EXTENSION_TYPE_LABELS[request.type].toLowerCase();
  return (
    <ListRow
      s={s}
      avatar={
        <Avatar
          size={46 * s}
          fill={pastelFor(request.requestedBy)}
          name={request.requester?.name ?? "?"}
        />
      }
      title={task.title}
      line={`${who} asks for ${until} · ${type}`}
      aside={canDecide ? "Yours" : feature.title}
      dot={canDecide ? colors.yellow : undefined}
      label={`${who} asks for more time on ${task.title}, until ${until}, ${type}. ${
        canDecide ? "Yours to decide." : `Part of ${feature.title}.`
      }`}
      hint="Opens the task, where it's decided"
      onPress={onPress}
    />
  );
}
