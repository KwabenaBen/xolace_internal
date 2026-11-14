import { useLocalSearchParams } from "expo-router";
import type { JSX } from "react";

import { PhonePersonLogs } from "@/components/logs/phone-person-logs";
import { WebPersonLogs } from "@/components/web/logs/web-person-logs";
import { useIsDesktop } from "@/lib/use-desktop";

/**
 * One person's daily logs and missed weekdays (the website's page on a wide browser window).
 * `from=people` when opened from their card on People, so the website's breadcrumb leads back
 * there (the phone's back button already does).
 */
export default function PersonLogsScreen(): JSX.Element {
  const { userId, from } = useLocalSearchParams<{ userId: string; from?: string }>();
  return useIsDesktop() ? (
    <WebPersonLogs userId={userId} fromPeople={from === "people"} />
  ) : (
    <PhonePersonLogs userId={userId} />
  );
}
