import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Spinner } from "heroui-native";
import { useState, type JSX } from "react";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { isWeekendDate } from "@convex/lib/dates";

import { useToday } from "@/components/logs/log-days";
import { LogForm, type LinkableTask } from "@/components/logs/log-form";
import { Screen } from "@/components/screen";
import { useToast } from "@/components/ui/toast";
import { useSignedInUser } from "@/lib/use-current-user";

/**
 * Write or edit today's log (from the Logs tab). Loads today's log, if any, and the tasks you can
 * link; after saving, back to where it was opened.
 */
export default function WriteLogScreen(): JSX.Element {
  const user = useSignedInUser();
  // The day the form opened on, kept even if midnight (GMT) passes while it's open: what's typed
  // stays on screen, and saving then says the day is locked (the server's rule) instead of the
  // form wiping itself for the new day.
  const { today: current } = useToday();
  const [today] = useState(current);
  const day = useQuery(api.dailyLogs.day, { date: today });
  const linkable = useQuery(api.dailyLogs.linkableTasks, { date: today });
  const save = useMutation(api.dailyLogs.save);
  const router = useRouter();
  const toast = useToast();
  const isWeekend = isWeekendDate(today);

  if (day === undefined || linkable === undefined) {
    return (
      <Screen withHeader dialogTitle="Today's log">
        <Spinner />
      </Screen>
    );
  }
  const existing = day.people.find((p) => p.user._id === user._id)?.log ?? null;
  // Tasks already linked stay choosable even if they've since been verified.
  const tasks: LinkableTask[] = [...linkable];
  for (const task of existing?.tasks ?? []) {
    if (!tasks.some((t) => t._id === task._id)) tasks.push(task);
  }

  return (
    <LogForm
      isWeekend={isWeekend}
      isEdit={existing !== null}
      tasks={tasks}
      initial={{
        done: existing?.done ?? "",
        next: existing?.next ?? "",
        blockers: existing?.blockers ?? "",
        // Only tasks that still exist (the view leaves out removed ones).
        taskIds: existing?.tasks.map((t) => t._id) ?? [],
      }}
      onSubmit={async (values) => {
        await save({
          date: today,
          done: values.done,
          next: isWeekend ? undefined : values.next,
          blockers: isWeekend ? undefined : values.blockers,
          taskIds: isWeekend ? undefined : (values.taskIds as Id<"tasks">[]),
        });
        toast(existing ? "Log updated" : isWeekend ? "Line saved" : "Log saved");
      }}
      onSaved={() => {
        if (router.canGoBack()) router.back();
        else router.replace("/logs");
      }}
    />
  );
}
