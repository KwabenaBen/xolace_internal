import type { FunctionReturnType } from "convex/server";

import type { api } from "@convex/_generated/api";
import { calendarDaysBetween, endOfDayGmt, shortDay } from "@convex/lib/dates";
import type { ExtensionType, FeatureStatus, Role, TaskStatus } from "@convex/lib/validators";

import { clock, hoursLabel } from "@/components/team-rules/rules";
import {
  EXTENSION_TYPE_LABELS,
  FEATURE_STATUS_LABELS,
  TASK_STATUS_LABELS,
} from "@/constants/labels";

export type ActivityItem = FunctionReturnType<typeof api.activity.forTask>[number];

/** One activity entry as words: "Kofi" + "moved it to In progress at 40%", and what they wrote. */
export type Described = {
  /** Who did it: their name, or "Cadence" for the app itself (e.g. flagging a task overdue). */
  who: string;
  /** The rest of the sentence. */
  what: string;
  /** Words they wrote (a comment, a note, a reason), shown as a quote under the sentence. */
  quote?: string;
  /** How it looks: a comment bubble, a warning (overdue, late), or a plain line. */
  tone: "comment" | "warning" | "good" | "plain";
};

const SETTING_NAMES: Record<string, string> = {
  adminTaskReviewer: "the admin task reviewer",
  morningDigestTime: "the morning digest time",
  dailyLogReminderTime: "the daily log reminder time",
  timeZone: "the team time zone",
  extensionLateWindowHours: "the late window",
};

const PLAN_FIELDS: Record<string, string> = {
  title: "title",
  description: "description",
  kind: "type",
  acceptanceCriteria: "acceptance criteria",
  ownerId: "owner",
  peerReviewerId: "peer reviewer",
  deadline: "deadline",
  priority: "priority",
  expectedResult: "expected result",
  sourceNote: "source note",
};

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}
function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}
function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function status(value: unknown): string {
  return typeof value === "string" && value in TASK_STATUS_LABELS
    ? TASK_STATUS_LABELS[value as TaskStatus]
    : "a new status";
}
function settingValue(key: string, value: unknown): string {
  if (key === "morningDigestTime" || key === "dailyLogReminderTime") return clock(value);
  if (key === "extensionLateWindowHours" && typeof value === "number") return hoursLabel(value);
  const ref = record(value);
  if (typeof ref.email === "string") {
    // Members don't see the email of someone who hasn't joined (the server leaves it empty).
    return ref.email !== "" ? ref.email : "someone who hasn't joined yet";
  }
  return typeof value === "string" ? value.replace(/_/g, " ") : "a new value";
}
/** "just now", "5 min ago", "3 h ago", "yesterday", else "Tue 11 Nov". */
export function timeAgo(ms: number, now: number): string {
  const minutes = Math.floor((now - ms) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24 && new Date(ms).getUTCDate() === new Date(now).getUTCDate()) {
    return `${hours} h ago`;
  }
  const days = calendarDaysBetween(ms, now);
  if (days === 1) return "yesterday";
  return shortDay(ms, now);
}

/** A log's day ("2026-11-12") as "Wed 12 Nov"; "a day" if it isn't one. */
function logDay(date: unknown, now: number): string {
  const ms = typeof date === "string" ? endOfDayGmt(date) : null;
  return ms === null ? "a day" : shortDay(ms, now);
}

function list(words: string[]): string {
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

/**
 * Turns an activity entry into a sentence. On a task's own page (`inTask`) the task is "it";
 * in the team feed it's named. `now` sets whether dates show their year.
 */
export function describeActivity(
  item: ActivityItem,
  { inTask, now }: { inTask: boolean; now: number }
): Described {
  const before = record(item.before);
  const after = record(item.after);
  const who = item.actor?.name ?? "Cadence";
  const it = inTask ? "it" : (item.task?.title ?? "a task");
  const day = (ms: unknown) => (typeof ms === "number" ? shortDay(ms, now) : "a new date");
  const plain = (what: string, quote?: string): Described => ({ who, what, quote, tone: "plain" });

  switch (item.action) {
    case "task.created":
      return plain(inTask ? "created this task" : `created ${it}`);
    case "task.proposed":
      return plain(inTask ? "proposed this task" : `proposed ${it}`);
    case "task.proposal_approved":
      return { who, what: `approved ${inTask ? "the proposal" : it}`, tone: "good" };
    case "task.proposal_declined":
      return plain(`declined ${inTask ? "the proposal" : it}`, text(after.declineReason));
    case "task.updated": {
      // A deadline move is named with its dates; the other changes are listed after it.
      const others = Object.keys(after)
        .filter((k) => k !== "deadline")
        .map((k) => PLAN_FIELDS[k] ?? k);
      if (after.deadline !== undefined && before.deadline !== undefined) {
        const its = inTask ? "its" : `${it}'s`;
        const why =
          typeof after.deadlineChangeType === "string"
            ? ` (${(EXTENSION_TYPE_LABELS[after.deadlineChangeType as ExtensionType] ?? "Other").toLowerCase()})`
            : "";
        const also = others.filter((o) => o !== "deadlineChangeType" && o !== "countsAsLate");
        const rest = also.length > 0 ? ` and changed the ${list(also)}` : "";
        const late = after.countsAsLate === true ? ". It counts as late" : "";
        return {
          who,
          what: `moved ${its} deadline from ${day(before.deadline)} to ${day(after.deadline)}${why}${rest}${late}`,
          tone: after.countsAsLate === true ? "warning" : "plain",
        };
      }
      return plain(`edited ${it}${others.length > 0 ? `: ${list(others)}` : ""}`);
    }
    case "task.update_posted": {
      const moved = before.status !== after.status;
      const progress = num(after.progress);
      const progressed = num(before.progress) !== progress && progress !== undefined;
      const note = text(after.note);
      let what: string;
      if (moved) {
        what =
          after.status === "blocked"
            ? `marked ${it} blocked`
            : `moved ${it} to ${status(after.status)}`;
        if (progressed) what += ` at ${progress}%`;
      } else if (progressed) {
        what = `set ${it} to ${progress}%`;
      } else {
        what = `posted an update on ${it}`;
      }
      return { who, what, quote: note, tone: after.status === "blocked" ? "warning" : "plain" };
    }
    case "task.became_overdue":
      return {
        who: "Cadence",
        what: `flagged ${it} overdue: its deadline passed`,
        tone: "warning",
      };
    case "task.peer_review_requested":
      return plain(`asked for a peer review on ${it}`, text(after.note));
    case "task.peer_review_approved":
      return {
        who,
        what: inTask ? "approved the code" : `approved the code on ${it}`,
        quote: text(after.note),
        tone: "good",
      };
    case "task.peer_review_changes_requested":
      return {
        who,
        what: `sent ${it} back after peer review`,
        quote: text(after.note),
        tone: "warning",
      };
    case "task.submitted":
      return plain(`submitted ${it} for verification`, text(after.note));
    case "task.verified":
      return { who, what: `verified ${it}`, quote: text(after.note), tone: "good" };
    case "task.changes_requested":
      return { who, what: `asked for changes on ${it}`, quote: text(after.note), tone: "warning" };
    case "task.review_withdrawn":
      return plain(
        `took ${it} back from ${after.stage === "peer_review" ? "peer review" : "verification"}`
      );
    case "feature.status_changed": {
      const stage =
        typeof after.status === "string" && after.status in FEATURE_STATUS_LABELS
          ? FEATURE_STATUS_LABELS[after.status as FeatureStatus]
          : "a new stage";
      return {
        who: "Cadence",
        what: `moved ${item.feature?.title ?? "a feature"} to ${stage}`,
        tone: after.status === "internal_testing" ? "good" : "plain",
      };
    }
    case "feature.shipped":
      return { who, what: `marked ${item.feature?.title ?? "a feature"} as live`, tone: "good" };
    case "comment.added":
      return {
        who,
        what: inTask ? "commented" : `commented on ${it}`,
        quote: text(after.body),
        tone: "comment",
      };
    case "extension.requested": {
      const type = EXTENSION_TYPE_LABELS[after.type as ExtensionType] ?? "Other";
      const past = after.beyondFeatureDeadline === true ? ", past the feature's deadline" : "";
      return plain(
        `asked for more time on ${it}: until ${day(after.requestedDeadline)} (${type.toLowerCase()}${past})`,
        text(after.reason)
      );
    }
    case "extension.approved":
      return {
        who,
        what: `gave ${it} more time: now due ${day(after.deadline)}${after.countsAsLate === true ? ". It counts as late" : ""}`,
        quote: text(after.note),
        tone: after.countsAsLate === true ? "warning" : "good",
      };
    case "extension.declined":
      return plain(`said no to more time on ${it}`, text(after.note));
    case "extension.withdrawn":
      return plain(`withdrew their request for more time on ${it}`);
    case "extension.closed":
      return plain(`closed the request for more time on ${it}: it has a new owner`);
    case "feature.created":
      return plain(`created the feature ${item.feature?.title ?? text(after.title) ?? ""}`.trim());
    case "feature.updated":
      return plain(`edited the feature ${item.feature?.title ?? ""}`.trim());
    case "feature.deadline_extended":
      return plain(
        `moved ${item.feature !== null ? `${item.feature.title}'s` : "the feature's"} deadline to ${day(after.deadline)}`
      );
    case "user.signed_up":
      return { who, what: "joined Cadence", tone: "good" };
    case "user.role_changed": {
      const role = after.role as Role | undefined;
      const person = item.person?.name ?? "someone";
      return plain(`made ${person} ${role === "admin" ? "an admin" : "a member"}`);
    }
    case "user.deactivated":
      return plain(`deactivated ${item.person?.name ?? "someone"}`);
    case "user.reactivated":
      return plain(`reactivated ${item.person?.name ?? "someone"}`);
    case "invite.created":
      return plain(
        `invited ${text(after.email) ?? "someone"}${text(after.title) ? ` as ${String(after.title)}` : ""}`
      );
    case "invite.code_renewed":
      return plain("made a new invite code");
    case "invite.revoked":
      return plain(`revoked the invite for ${text(before.email) ?? "someone"}`);
    case "dailyLog.written":
      return plain(
        `wrote their ${after.isWeekend === true ? "weekend line" : "log"} for ${logDay(after.date, now)}`
      );
    case "dailyLog.edited":
      return plain(`edited their log for ${logDay(after.date, now)}`);
    case "dailyLog.missed":
      return plain(
        `recorded no log from ${item.person?.name ?? "someone"} on ${logDay(after.date, now)}`
      );
    case "setting.created":
    case "setting.updated": {
      const name = SETTING_NAMES[item.entityId] ?? "a team rule";
      return plain(`set ${name} to ${settingValue(item.entityId, item.after)}`);
    }
    default:
      return plain(item.action.replace(/[._]/g, " "));
  }
}
