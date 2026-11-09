import type { SymbolSpec } from "@/components/board/sym";

/** SF Symbols on iOS, Material icons elsewhere, for the task page. */
export const taskSymbols = {
  back: { ios: "chevron.left", fallback: "chevron-left", fit: 1 },
  openFeature: { ios: "arrow.up.right", fallback: "arrow-top-right", fit: 1 },
  edit: { ios: "pencil", fallback: "pencil", fit: 1 },
  approve: { ios: "checkmark", fallback: "check", fit: 1 },
  decline: { ios: "xmark", fallback: "close", fit: 1 },
  feature: { ios: "square.stack.3d.up.fill", fallback: "layers", fit: 1.1 },
  criterion: { ios: "circle", fallback: "checkbox-blank-circle-outline", fit: 1 },
  verified: { ios: "checkmark.seal.fill", fallback: "check-decagram", fit: 1.1 },
  info: { ios: "info.circle", fallback: "information-outline", fit: 1 },
} as const satisfies Record<string, SymbolSpec>;
