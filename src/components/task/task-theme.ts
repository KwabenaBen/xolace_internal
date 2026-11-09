import type { TaskStatus } from "@convex/lib/validators";

/**
 * The task page's look: the Board's black and Montserrat, a holographic status card after Native
 * Cook's "Holo Cash Card" block, and pastel cards and day pills sampled from the team's fitness-app
 * reference. Pastels carry black text; the black page carries white.
 */
export const taskColors = {
  page: "#000000",
  card: "#0b0b0d", // the holo card
  white: "#FFFFFF",
  ink: "#111111",
  grey: "#a5a5aa", // the countdown's seconds, like the block's accruing digits
  note: "#8a8a8f",
  secondary: "rgba(235,235,245,0.6)",
  lavender: "rgb(172,153,245)",
  lavenderStrong: "rgb(173,152,253)",
  peach: "rgb(254,189,89)",
  sky: "rgb(167,203,255)",
  pink: "rgb(255,161,255)",
  pill: "rgb(255,248,249)",
  pillBorder: "rgb(222,212,255)",
  magenta: "#e93ad8", // the block's rate tag
  sticker: "#f5ec3d", // the block's BOOST sticker
  late: "rgb(247,26,33)",
  tagFill: "rgba(255,255,255,0.72)",
  panel: "rgb(20,18,21)",
  hairline: "rgba(255,255,255,0.12)",
} as const;

/** The word the holo card spells for each status (short, so the condensed type stays big). */
export const STATUS_WORDS: Record<TaskStatus, string> = {
  proposed: "PROPOSED",
  declined: "DECLINED",
  todo: "TO DO",
  in_progress: "IN PROGRESS",
  blocked: "BLOCKED",
  in_peer_review: "IN REVIEW",
  submitted: "SUBMITTED",
  verified: "VERIFIED",
  changes_requested: "CHANGES",
};
