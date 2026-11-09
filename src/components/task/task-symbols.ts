import type { SymbolSpec } from "@/components/ui/sym";

/** SF Symbols on iOS, Material icons elsewhere, for the task page. */
export const taskSymbols = {
  approve: { ios: "checkmark", fallback: "check", fit: 1 },
  decline: { ios: "xmark", fallback: "close", fit: 1 },
  info: { ios: "info.circle", fallback: "information-outline", fit: 1 },
} as const satisfies Record<string, SymbolSpec>;
