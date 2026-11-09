import { useQuery } from "convex/react";
import { useRouter } from "expo-router";

import { api } from "@convex/_generated/api";

import { ROLE_LABELS } from "@/constants/labels";
import { useSignedInUser } from "@/lib/use-current-user";

import type { Row } from "./crs-theme";

/** "08:00" → "8:00 AM". */
function clock(value: unknown): string {
  if (typeof value !== "string" || !/^\d{2}:\d{2}$/.test(value)) return "Not set";
  const [h, m] = value.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/**
 * The Settings screen's five rows, in the order the clay icons are drawn (bell, crescent, people,
 * shield, padlock), with today's values from the team settings and the team list. Day and night
 * values are the same: they're facts, not moods.
 */
export function useSettingsRows(): Row[] {
  const router = useRouter();
  const user = useSignedInUser();
  const settings = useQuery(api.settings.list);
  const users = useQuery(api.users.list);

  const value = (key: string) => settings?.find((s) => s.key === key)?.value;
  const loading = "…";
  const digest = settings === undefined ? loading : clock(value("morningDigestTime"));
  const reminder = settings === undefined ? loading : clock(value("dailyLogReminderTime"));
  const people = users === undefined ? loading : `${users.filter((u) => u.isActive).length} people`;
  const reviewerRef = value("adminTaskReviewer");
  const reviewerId =
    typeof reviewerRef === "object" && reviewerRef !== null && "userId" in reviewerRef
      ? reviewerRef.userId
      : undefined;
  const reviewer =
    settings === undefined || users === undefined
      ? loading
      : (users.find((u) => u._id === reviewerId)?.name.split(" ")[0] ?? "Not set");

  return [
    {
      title: "Notifications",
      day: digest,
      night: digest,
      hint: "The morning digest's time. Notifications arrive in a later phase.",
    },
    { title: "Daily log reminder", day: reminder, night: reminder },
    { title: "People", day: people, night: people },
    { title: "Team rules", day: reviewer, night: reviewer },
    {
      title: "Account & security",
      day: ROLE_LABELS[user.role],
      night: ROLE_LABELS[user.role],
      onPress: () => router.push("/settings/account"),
      hint: "Your profile, and sign out",
    },
  ];
}
