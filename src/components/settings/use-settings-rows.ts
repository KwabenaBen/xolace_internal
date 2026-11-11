import { useQuery } from "convex/react";
import { useRouter } from "expo-router";

import { api } from "@convex/_generated/api";

import {
  clock,
  firstName,
  reviewerOf,
  timeValue,
  type TimeKey,
} from "@/components/team-rules/rules";
import { ROLE_LABELS } from "@/constants/labels";
import { useSignedInUser } from "@/lib/use-current-user";

import type { Row } from "./crs-theme";

/**
 * The Settings screen's five rows, in the order the clay icons are drawn (bell, crescent, people,
 * shield, padlock), with today's values from the team settings and the team list. Day and night
 * values are the same: they're facts, not moods. For admins, the two time rows open their time
 * sheet (`onEditTime`); Team rules opens its page for everyone.
 */
export function useSettingsRows({ onEditTime }: { onEditTime: (key: TimeKey) => void }): Row[] {
  const router = useRouter();
  const user = useSignedInUser();
  const isAdmin = user.role === "admin";
  const settings = useQuery(api.settings.list);
  const users = useQuery(api.users.list);

  const loading = "…";
  const digest = settings === undefined ? loading : clock(timeValue(settings, "morningDigestTime"));
  const reminder =
    settings === undefined ? loading : clock(timeValue(settings, "dailyLogReminderTime"));
  const people = users === undefined ? loading : `${users.filter((u) => u.isActive).length} people`;
  const reviewer = (() => {
    if (settings === undefined || users === undefined) return loading;
    const who = reviewerOf(settings.find((s) => s.key === "adminTaskReviewer")?.value, users);
    return who.kind === "person"
      ? firstName(who.person.name)
      : who.kind === "invited"
        ? "Invited"
        : "Not set";
  })();

  return [
    {
      title: "Notifications",
      day: digest,
      night: digest,
      onPress:
        isAdmin && settings !== undefined ? () => onEditTime("morningDigestTime") : undefined,
      hint: isAdmin
        ? "Change the morning digest's time. Notifications arrive in a later update."
        : "The morning digest's time. Notifications arrive in a later update.",
    },
    {
      title: "Daily log reminder",
      day: reminder,
      night: reminder,
      onPress:
        isAdmin && settings !== undefined ? () => onEditTime("dailyLogReminderTime") : undefined,
      hint: isAdmin ? "Change the weekday reminder's time" : undefined,
    },
    {
      title: "People",
      day: people,
      night: people,
      onPress: () => router.push("/settings/people"),
      hint: isAdmin ? "The team, invites and roles" : "Who's on the team",
    },
    {
      title: "Team rules",
      day: reviewer,
      night: reviewer,
      onPress: () => router.push("/settings/team-rules"),
      hint: isAdmin
        ? "Who verifies admins' tasks, the team's times and the late window"
        : "Who verifies admins' tasks, and the team's times",
    },
    {
      title: "Account & security",
      day: ROLE_LABELS[user.role],
      night: ROLE_LABELS[user.role],
      onPress: () => router.push("/settings/account"),
      hint: "Your profile, and sign out",
    },
  ];
}
