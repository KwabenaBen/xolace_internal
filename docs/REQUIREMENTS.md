# Cadence — Requirements v1

## Overview

Cadence is an internal iOS app that keeps the four cofounders accountable on every agreed feature: who owns what, how far along it is, and whether deadlines are met.

- **Team:** 4 users — CEO, CTO, CMO/CDO, COO.
- **Problem:** after each meeting, agreed features and deadlines have no single place to live, so it is unclear who is working on what, who is behind, and what is actually done.
- **Goal for v1:** every task has one owner and one deadline, everyone sees everything, progress and daily work are logged, and nothing counts as done until it is verified.

## Users & roles

The COO is the single admin; the other three are members. Visibility is open: every user sees every feature, task, log and status.

| Role | Who | Can do |
| --- | --- | --- |
| Admin | COO | Create features and tasks (on web or phone), write acceptance criteria, approve task proposals, assign owners, set deadlines, approve or decline extension requests, verify that acceptance criteria are met, manage users |
| Member | CEO, CTO, CMO/CDO | View everything, update status and progress on their own tasks, write daily logs, comment, propose new tasks, request deadline extensions on their own tasks, peer-review code tasks, submit tasks for verification |

All permission checks run on the server (Convex functions), not only in the app UI.

**Two separate checks:** a code task is first peer-reviewed for quality (the CTO reviews the CEO's code and the CEO reviews the CTO's). It is then verified against its acceptance criteria by the COO, or by the CEO when the COO owns the task, so nobody approves their own work.

## Core workflow

Every feature starts in a meeting and ends in production, with the COO's verification as the only gate to "done".

```
Meeting (feature agreed) -> COO plans it (tasks, deadlines, acceptance criteria) -> Owner assigned
-> Owner builds (progress + daily logs) -> Peer review (code tasks) -> Submit with proof
-> Verifier checks acceptance criteria
     yes -> Task verified -> (all tasks verified) -> Feature: Internal testing -> Shipped
     no  -> Changes requested -> back to Owner builds
```

Code tasks usually go to the CEO and CTO, design and content to the CMO/CDO, and partner or operations work to the COO. Code tasks pass a peer review before submission. Rejected work loops back to the owner with a reason; a feature reaches internal testing only when every task in it is verified.

## MVP features

Version 1 ships five features; the dashboard and everything else wait.

1. **Features & task assignment**
   - Admin creates a feature with description, expected result, a hard deadline and a source note (e.g. which meeting it came from).
   - Feature is split into tasks; each task has exactly one owner, a deadline (on or before the feature's), a priority and written acceptance criteria.
   - Code tasks name a peer reviewer.
   - Every task is visible to all users on a shared board, filterable by owner, feature and status.
   - Members can propose tasks; a proposal goes live only after admin approval.
2. **Progress tracking**
   - Task status: Proposed, To do, In progress, Blocked, In peer review, Submitted, Verified, Changes requested.
   - Owner sets a progress percentage and can add a short update or comment.
   - Overdue tasks are flagged automatically once the deadline passes without verification.
   - Every change is written to an activity log (who, what, when).
3. **Deadline extensions**
   - Owner requests a new deadline with a reason and a type: scope change (agreed in a meeting) or other.
   - Admin approves or declines.
   - An approved extension counts as late only if it was requested within 24 hours of the deadline or its type is "other"; scope-change extensions requested earlier keep the task on time.
4. **Daily logs**
   - Weekdays: one short log per user (what I did, what's next, blockers, linked tasks); missed weekdays are recorded.
   - Weekends: optional one-line log; never counted as missed.
5. **Peer review & verification**
   - Code tasks: owner requests peer review; reviewer approves or sends back with comments before the task can be submitted.
   - Owner submits with a note and optional proof (link, screenshot, PR or build link).
   - Admin checks each acceptance criterion and verifies, or requests changes with a reason; the CEO does this for COO-owned tasks.
   - A feature moves to Internal testing only when all its tasks are verified, then to Shipped when the admin marks it live.

**Notifications (part of the features above)**

- **Morning digest, 8am GMT, one push:** your tasks due in the next 48 hours, your overdue tasks, reviews waiting on you, and whether yesterday's log is missing (weekdays).
- **Immediate push only for:** task assigned, review or verification requested, verified or changes requested, extension or proposal decided.
- **Daily log reminder:** weekdays at 8pm GMT, only if the log is not yet in.

## Data model

Ten Convex tables cover v1; a feature holds tasks, and everything else hangs off tasks and users.

| Table | Key fields | Relations |
| --- | --- | --- |
| users | name, email, title (free text, e.g. CTO), role (admin/member), isActive, pushToken, timezone | owns tasks, writes logs |
| features | title, description, expectedResult, sourceNote, deadline, status (Planned/In progress/Internal testing/Shipped), createdBy | has many tasks |
| tasks | title, description, acceptanceCriteria (list), ownerId, peerReviewerId (code tasks), proposedBy, deadline, originalDeadline, priority, status, progress (0–100), countsAsLate, submittedAt, verifiedAt | belongs to feature and user |
| extensionRequests | taskId, requestedBy, requestedAt, currentDeadline, requestedDeadline, reason, type (scope change/other), status (pending/approved/declined), reviewerId | belongs to task |
| verifications | taskId, stage (peer review/verification), submittedBy, note, proofUrl, decision (approved/changes requested), reviewerId, reason | belongs to task |
| dailyLogs | userId, date, isWeekend, done, next, blockers, taskIds | belongs to user, links tasks |
| comments | taskId, authorId, body | belongs to task |
| activity | actorId, entityType, entityId, action, before, after, timestamp | audit trail for everything |

Two support tables complete the set: invites (email, role, title, invitedBy, usedAt), so only invited emails can sign up, and settings (key/value rules such as which user reviews admin-owned tasks, digest and reminder times). The old meetings table is replaced by `sourceNote` on each feature. A `notifications` table can be added later if delivery history is needed.

## Tech stack & architecture

One Expo codebase builds the iOS app and a web version for planning on a laptop; Convex is the whole backend, so no separate server is needed for v1.

| Layer | Choice | Notes |
| --- | --- | --- |
| Mobile app | Expo (React Native, TypeScript), Expo Router | iOS first; Android later from the same code |
| Web | Expo web build (same code) | Mainly for the COO to plan features and tasks after meetings |
| Backend & database | Convex | Queries, mutations, real-time sync, schema validation |
| Scheduled jobs | Convex crons + scheduled functions | Morning digest, overdue flags, daily log reminder |
| Push notifications | Expo Push Notifications, sent from Convex actions | Apple Developer account already in place |
| Auth | Convex Auth (email + password) | Invite-only: no public sign-up; admin adds the 4 users |
| File proof | Convex file storage | Screenshots attached to verifications |
| Node.js | Convex actions (Node runtime) | Push sending now; GitHub webhooks later |
| Distribution | EAS Build + TestFlight; web on a static host | Internal app; no App Store listing needed |

## Non-functional requirements

- **Platform:** iOS first for everyone; the web version must handle all admin planning screens; layouts must not break on small iPhones.
- **Connectivity:** online-only; show a clear offline banner instead of failing silently.
- **Real-time:** status changes, logs and reviews appear on all devices within a few seconds (Convex subscriptions).
- **Notifications:** one digest a day plus a short list of immediate events; times stored in GMT (Ghana time).
- **Performance:** main screens load in under 2 seconds on a normal mobile connection.
- **Security:** invite-only accounts, role checks in every Convex function, members cannot edit others' tasks or anyone's deadlines, no secrets in the app bundle.
- **Accountability integrity:** deadlines, reviews, verifications and logs cannot be deleted; changes are recorded in the activity log.
- **Tone:** the app reports team progress, not rankings; there is no leaderboard in v1.

**Built to grow:** nothing is hard-coded to four people or to these titles. Roles, reviewers and the CEO-reviews-COO rule are stored as settings, more than one admin is allowed, and users can be added or deactivated without code changes.

## Build phases

Six phases, one Claude Code session each; a phase starts only when the previous one runs on a device, and v1 launches after phase 6.

1. **Foundation** — Expo (iOS + web) + Convex project, TypeScript, folder structure, schema for all tables, Convex Auth with email + password, invite-only users, admin/member roles, seed the 4 users.
2. **Features & tasks** — create/edit features and tasks with acceptance criteria (admin, web and phone), task proposals and approval, assign owner, peer reviewer and deadline, shared board with filters, task detail screen.
3. **Progress & extensions** — status changes, progress %, comments, overdue flag, extension requests and the late rule, activity log.
4. **Daily logs** — weekday log form, optional weekend one-liner, history per user, missed-weekday tracking.
5. **Peer review & verification** — peer review step for code tasks, submit with note and proof, verification queue against acceptance criteria (CEO for COO-owned tasks), feature status rollup.
6. **Notifications & release** — push token registration, immediate pushes, morning digest and log reminder crons, empty/loading/error states, offline banner, EAS build to TestFlight, web deploy.

## Later features (GitHub vibes)

Out of scope for v1; listed so the v1 data model leaves room for them.

- **v1.1 — Team health dashboard:** team-level view first (features on track, overdue count, extensions this month, log consistency), per-person detail second; reviewed together in the weekly meeting rather than used as one person's monitoring tool.
- GitHub integration: link commits and PRs to tasks, run peer review through PRs, auto-move a task to Submitted when its PR is merged.
- Contribution graph per user (GitHub-style heatmap from logs and completed tasks).
- Labels, milestones and issue-style threads on features.
- Meeting notes with action items that turn directly into tasks.
- Android build.

## Decisions

| Question | Decision |
| --- | --- |
| Why build instead of using Linear or Notion | An in-house tool that is fully ours: no vendor limits, our own data, and room to grow with the company as new members and workers join; v1 build time is capped at the six phases |
| How "done" is judged | Acceptance criteria written at task creation; COO verifies against them |
| Code quality | Peer review between CEO and CTO before submission |
| Who verifies the COO's own tasks | The CEO |
| Who creates tasks | COO creates; members can propose, and the COO approves before a proposal goes live |
| Deadline extensions | Owner requests with reason and type; COO approves; late only if requested within 24 hours of the deadline or not a scope change |
| Daily logs | Required on weekdays; weekends optional, one line, never counted as missed |
| Notifications | One 8am GMT digest; immediate pushes only for assignments, reviews and decisions; weekday log reminder at 8pm GMT |
| Dashboard | Moved to v1.1, framed as team health, reviewed together |
| Platforms | iOS for everyone, plus an Expo web build for admin planning |
| Login | Email + password, invite-only |
| Apple Developer account | Already in place |
| App name | Cadence |
