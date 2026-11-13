import type { JSX } from "react";

import { PhoneLogs } from "@/components/logs/phone-logs";
import { WebLogs } from "@/components/web/logs/web-logs";
import { useIsDesktop } from "@/lib/use-desktop";

/**
 * Daily logs: today's log, your week and the team's day. On a wide browser window it's the
 * website layout's page (src/components/web/logs/); everywhere else, the phone's tab.
 */
export default function LogsScreen(): JSX.Element {
  return useIsDesktop() ? <WebLogs /> : <PhoneLogs />;
}
