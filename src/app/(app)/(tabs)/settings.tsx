import { useQuery } from "convex/react";
import { useState, type JSX } from "react";

import { api } from "@convex/_generated/api";

import { ClayRelightSettings } from "@/components/settings/ClayRelightSettings";
import { useSettingsRows } from "@/components/settings/use-settings-rows";
import { TimeRuleSheet } from "@/components/team-rules/rule-sheets";
import { ruleValue, timeValue, zoneLabel, type TimeKey } from "@/components/team-rules/rules";
import { chooseTheme, useIsDarkTheme } from "@/lib/theme-preference";

/**
 * Settings: Native Cook's Clay Relight block. Its Dark mode switch is Cadence's theme (black or
 * off-white, remembered on this device); its rows are Cadence's settings. An admin tapping
 * Notifications or Daily log reminder changes that time in a sheet, as on Team rules.
 */
export default function SettingsScreen(): JSX.Element {
  const [editing, setEditing] = useState<TimeKey | null>(null);
  const rows = useSettingsRows({ onEditTime: setEditing });
  const rules = useQuery(api.settings.list);
  const isDark = useIsDarkTheme();
  return (
    <>
      <ClayRelightSettings
        rows={rows}
        isDark={isDark}
        onDarkChange={(dark) => chooseTheme(dark ? "dark" : "light")}
      />
      {editing !== null && rules !== undefined ? (
        <TimeRuleSheet
          settingKey={editing}
          value={timeValue(rules, editing)}
          zone={zoneLabel(ruleValue(rules, "timeZone"))}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}
