import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import {
  activityEntityTypeValidator,
  extensionStatusValidator,
  extensionTypeValidator,
  featureStatusValidator,
  roleValidator,
  settingKeyValidator,
  settingValueValidator,
  taskKindValidator,
  taskPriorityValidator,
  taskStatusValidator,
  verificationDecisionValidator,
  verificationStageValidator,
} from "./lib/validators";

/**
 * Cadence data model (docs/REQUIREMENTS.md → "Data model").
 *
 * Conventions:
 * - Points in time (deadlines, decisions, timestamps) are ms since epoch (`Date.now()`).
 *   A deadline picked as a date is stored as the end of that day in GMT.
 * - Calendar dates (daily logs) are "YYYY-MM-DD" strings in GMT.
 * - Index names list their fields: `by_a_and_b` indexes ["a", "b"].
 * - Deadlines, reviews, verifications and logs are never deleted; changes go to `activity`.
 */
export default defineSchema({
  // Convex Auth's tables (sessions, accounts, refresh tokens, ...). `users` is overridden below.
  ...authTables,

  users: defineTable({
    // Convex Auth's optional built-in fields. Cadence doesn't use them, but the library's
    // `users` shape includes them, so they stay for compatibility.
    image: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),

    // Cadence fields. Always set by the sign-up callback in convex/lib/accounts.ts.
    name: v.string(),
    email: v.string(), // normalised: trimmed + lower-case
    title: v.string(), // free text ("CTO", "Head of Ops", ...); never used in permission logic
    role: roleValidator,
    isActive: v.boolean(),
    pushToken: v.optional(v.string()),
    timezone: v.string(), // IANA name, e.g. "Africa/Accra"
  })
    // "email" and "phone" are the index names Convex Auth expects.
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_isActive", ["isActive"]),

  features: defineTable({
    title: v.string(),
    description: v.string(),
    expectedResult: v.string(),
    sourceNote: v.string(), // e.g. which meeting the feature came from
    deadline: v.number(),
    status: featureStatusValidator,
    createdBy: v.id("users"),
  })
    .index("by_status_and_deadline", ["status", "deadline"])
    .index("by_deadline", ["deadline"]),

  tasks: defineTable({
    featureId: v.id("features"),
    title: v.string(),
    description: v.string(),
    kind: taskKindValidator, // "code" tasks must name a peer reviewer
    acceptanceCriteria: v.array(v.string()),
    // Owner and deadline are unset only while a task is "proposed" or "declined"; mutations
    // enforce them for every live status.
    ownerId: v.optional(v.id("users")),
    peerReviewerId: v.optional(v.id("users")), // set for code tasks
    proposedBy: v.optional(v.id("users")), // set when a member proposed the task
    declineReason: v.optional(v.string()), // set when the admin declines a proposal
    deadline: v.optional(v.number()),
    originalDeadline: v.optional(v.number()),
    priority: taskPriorityValidator,
    status: taskStatusValidator,
    progress: v.number(), // 0–100
    countsAsLate: v.boolean(), // an approved extension counted as late (convex/lib/lateRule.ts)
    // Set by the hourly overdue job (convex/overdue.ts) once the deadline passes without
    // verification; cleared when the deadline moves to a later date.
    overdueSince: v.optional(v.number()),
    submittedAt: v.optional(v.number()),
    verifiedAt: v.optional(v.number()),
  })
    .index("by_featureId_and_status", ["featureId", "status"])
    .index("by_ownerId_and_status", ["ownerId", "status"])
    .index("by_ownerId_and_deadline", ["ownerId", "deadline"])
    .index("by_status_and_deadline", ["status", "deadline"])
    .index("by_peerReviewerId_and_status", ["peerReviewerId", "status"])
    .index("by_proposedBy_and_status", ["proposedBy", "status"])
    // The overdue job: tasks of a status not yet flagged, past their deadline.
    .index("by_status_and_overdueSince_and_deadline", ["status", "overdueSince", "deadline"]),

  extensionRequests: defineTable({
    taskId: v.id("tasks"),
    requestedBy: v.id("users"),
    requestedAt: v.number(),
    currentDeadline: v.number(),
    requestedDeadline: v.number(),
    reason: v.string(),
    type: extensionTypeValidator,
    status: extensionStatusValidator,
    // The requested date is later than the feature's deadline (when asked): approving it moves
    // the feature's deadline too.
    beyondFeatureDeadline: v.boolean(),
    // Team rules' late window when it was asked for: the late rule uses this, so changing the
    // window later doesn't change how a waiting request is judged.
    lateWindowHours: v.optional(v.number()),
    reviewerId: v.optional(v.id("users")), // who decided
    decidedAt: v.optional(v.number()),
    decisionNote: v.optional(v.string()), // required when declined
    countsAsLate: v.optional(v.boolean()), // set when approved (convex/lib/lateRule.ts)
  })
    .index("by_taskId_and_status", ["taskId", "status"])
    .index("by_status", ["status"])
    .index("by_requestedBy", ["requestedBy"]),

  verifications: defineTable({
    taskId: v.id("tasks"),
    stage: verificationStageValidator,
    submittedBy: v.id("users"),
    note: v.string(),
    proofUrl: v.optional(v.string()), // link, PR or build URL
    proofStorageId: v.optional(v.id("_storage")), // screenshot in Convex file storage
    decision: v.optional(verificationDecisionValidator), // unset while pending
    reviewerId: v.optional(v.id("users")),
    reason: v.optional(v.string()),
    decidedAt: v.optional(v.number()),
  })
    .index("by_taskId_and_stage", ["taskId", "stage"])
    .index("by_reviewerId_and_decision", ["reviewerId", "decision"])
    .index("by_stage_and_decision", ["stage", "decision"]),

  // One per person per GMT day, written that day (convex/dailyLogs.ts). Editable until the day
  // ends, then locked; never deleted. A weekend log is one line (`done`) with no tasks.
  dailyLogs: defineTable({
    userId: v.id("users"),
    date: v.string(), // "YYYY-MM-DD" in GMT
    isWeekend: v.boolean(),
    done: v.string(),
    next: v.optional(v.string()),
    blockers: v.optional(v.string()),
    taskIds: v.array(v.id("tasks")),
    updatedAt: v.optional(v.number()), // set by the last edit (ms)
    edits: v.optional(v.number()), // how many times it's been edited (capped: DAILY_LOG_LIMITS)
  })
    .index("by_userId_and_date", ["userId", "date"])
    .index("by_date", ["date"]),

  // A weekday someone didn't log, recorded just after it ended (dailyLogs.recordMissed). Part of
  // the record like the logs: never deleted, and a missed day can't be logged afterwards.
  missedDays: defineTable({
    userId: v.id("users"),
    date: v.string(), // "YYYY-MM-DD" in GMT, Monday to Friday
  })
    .index("by_userId_and_date", ["userId", "date"])
    .index("by_date", ["date"]),

  comments: defineTable({
    taskId: v.id("tasks"),
    authorId: v.id("users"),
    body: v.string(),
  }).index("by_taskId", ["taskId"]),

  activity: defineTable({
    actorId: v.optional(v.id("users")), // unset for scheduled jobs
    entityType: activityEntityTypeValidator,
    entityId: v.string(),
    action: v.string(), // e.g. "user.signed_up", "task.status_changed"
    before: v.optional(v.any()),
    after: v.optional(v.any()),
    timestamp: v.number(),
    // The task an entry is about (its own changes, its comments, its extension requests), so a
    // task page can show its history. Unset for entries about anything else.
    taskId: v.optional(v.id("tasks")),
  })
    .index("by_entityType_and_entityId", ["entityType", "entityId"])
    .index("by_actorId", ["actorId"])
    .index("by_taskId", ["taskId"]),

  invites: defineTable({
    email: v.string(), // normalised: trimmed + lower-case
    role: roleValidator,
    title: v.string(),
    invitedBy: v.optional(v.id("users")), // unset for invites created by the seed
    // One-time sign-up code (convex/lib/inviteCodes.ts), cleared once used. Sign-up needs the
    // email AND this code, before `expiresAt`. Invites from before codes existed have neither
    // and can't be used until an admin issues a code.
    code: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    usedAt: v.optional(v.number()),
    usedBy: v.optional(v.id("users")),
  }).index("by_email", ["email"]),

  settings: defineTable({
    key: settingKeyValidator,
    value: settingValueValidator,
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
});
