import { colors } from "@/components/ui/theme";

import type { DayMark } from "./log-days";

/**
 * Each day mark's sticker colours, on the phone and the website alike (the same in both themes,
 * with ink that reads on them): logged green, missed rose, today still open ringed in lavender.
 */
export const MARK_COLORS: Record<DayMark, { fill: string; ink: string; border: string }> = {
  logged: { fill: colors.green, ink: colors.ink, border: colors.green },
  missed: { fill: colors.rose, ink: colors.ink, border: colors.rose },
  open: { fill: colors.pill, ink: colors.ink, border: colors.lavenderStrong },
  future: { fill: colors.pill, ink: colors.note, border: colors.pillBorder },
  off: { fill: colors.pill, ink: colors.note, border: colors.pillBorder },
};
