import { useLocalSearchParams } from "expo-router";
import type { JSX } from "react";

import { PhonePersonLogs } from "@/components/logs/phone-person-logs";
import { WebPersonLogs } from "@/components/web/logs/web-person-logs";
import { useIsDesktop } from "@/lib/use-desktop";

/** One person's daily logs and missed weekdays (the website's page on a wide browser window). */
export default function PersonLogsScreen(): JSX.Element {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  return useIsDesktop() ? <WebPersonLogs userId={userId} /> : <PhonePersonLogs userId={userId} />;
}
