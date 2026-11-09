import type { JSX } from "react";

import { ClayRelightSettings } from "@/components/settings/ClayRelightSettings";
import { useSettingsRows } from "@/components/settings/use-settings-rows";
import { chooseTheme, useIsDarkTheme } from "@/lib/theme-preference";

/**
 * Settings: Native Cook's Clay Relight block. Its Dark mode switch is Cadence's theme (black or
 * off-white, remembered on this device); its rows are Cadence's settings.
 */
export default function SettingsScreen(): JSX.Element {
  const rows = useSettingsRows();
  const isDark = useIsDarkTheme();
  return (
    <ClayRelightSettings
      rows={rows}
      isDark={isDark}
      onDarkChange={(dark) => chooseTheme(dark ? "dark" : "light")}
    />
  );
}
