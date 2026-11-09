# Cadence

Internal task and accountability app for the four cofounders (CEO, CTO, CMO/CDO, COO). Every
task has one owner and one deadline, everyone sees everything, daily work is logged, and nothing
is done until it is verified. **Full spec: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) — read it
before starting a phase.** What's built, screen by screen, in plain language:
[docs/FEATURES.md](docs/FEATURES.md) — **update it whenever a feature or screen changes**
(a shareable copy for the team lives at https://claude.ai/artifact/4g1pqrfLbBeWmcf8snVGrH; keep
it in step when asked).

## Stack

- **App:** Expo SDK 58 (React Native 0.88, React 19.3), TypeScript strict, Expo Router (routes in
  `src/app`). One codebase for iOS and web.
- **UI:** HeroUI Native components + Uniwind (Tailwind v4 classes via `className`). HeroUI Native
  is officially "not recommended for web"; check every new screen on web too. The signed-out
  screens are a bespoke always-black design (RN primitives + Uniwind, not HeroUI).
- **Graphics:** `@shopify/react-native-skia` for the welcome dot animation on iOS (Skia is in Expo
  Go); the web build uses a plain 2D canvas instead (`*.web.tsx`) to avoid Skia's WebAssembly.
- **Backend:** Convex (database, functions, auth, crons later). Convex Auth 0.0.96 with the
  Password provider. Stay on 0.0.x until Convex Auth 2.0 is production-ready.
- **Package manager:** bun (`bun install`, `bun add`, `bunx …`). Use `bunx expo install` for
  Expo/React Native packages so versions match the SDK.

## Folder structure

```
src/app/                 Expo Router routes
  _layout.tsx            Providers, offline banner, auth gate (Stack.Protected)
  (auth)/                welcome → sign-in / sign-up (signed-out only; always black)
  (app)/_layout.tsx      Stack: loads the user, then (tabs) + pages + modal forms
  (app)/(tabs)/          Tabs: Board (index), My Tasks, Logs, Profile, Admin (admins only)
  (app)/features/        new (modal), [featureId]/index (page), [featureId]/edit (modal),
                         [featureId]/people/[userId] (one person's work on the feature)
  (app)/tasks/           new (modal: admin creates / member proposes), [taskId]/index (page),
                         [taskId]/edit (modal: edit a live task, or approve a proposal)
  (app)/board/[view].tsx The Board's tile pages: due-this-week, overdue, waiting (black style)
src/components/          Shared UI (Screen, PlaceholderScreen, OfflineBanner, ErrorScreen (the signed-in
                         area's error boundary), ...)
  auth/                  Signed-out UI: DotField (dots that spell "cadence"; dot-field.tsx = Skia,
                         dot-field.web.tsx = canvas, math in dot-formations.ts), DotWordmark,
                         PillButton, AuthTextField, AuthFormScreen
  planning/              Features & tasks UI: TaskCard, badges, DeadlineText,
                         OptionPicker (modal select), ChoiceChips, CriteriaEditor, DateField
                         (.web.tsx = browser date input), FeatureForm, TaskForm, AdminOnly
  board/                 The Board's bento (after Native Cook's "Paddock Widget Bento"):
                         board-theme.ts (colours/sizes in points on a 402-wide screen, ×s),
                         pit-stop.ts (the fling-out/slam-back motion, worklets), bento.tsx,
                         bento-tile.tsx, board-stats.ts, board-lists.ts (the tile pages' data),
                         feature-feed.tsx, sym.tsx (SF Symbol / Material icon)
  feature/               The feature and person pages: feature-team.ts (who's on a feature),
                         person-work.tsx (summary card, task card with criteria)
  task/                  The black detail pages' parts (task, feature, person): detail-page.tsx
                         (DetailPage shell, usePageSize, useGoBack), holo-card.tsx (Skia: the tilting status card, after Native
                         Cook's "Holo Cash Card"; .web.tsx = still SVG; holo-shared.ts),
                         countdown-card.tsx + odometer.tsx (rolling digits), people-cards.tsx,
                         task-panels.tsx, task-header.tsx (PageHeader), task-actions.tsx,
                         week-strip.tsx (unused; parked for Phase 4's daily logs),
                         task-dates.ts (GMT calendar maths), task-theme.ts, task-symbols.ts
src/constants/           theme.ts (spacing/layout/type tokens), labels.ts (enum display labels)
src/lib/                 Convex client, auth token storage, error messages, hooks (useNow, useDeviceFlag for
                         per-device yes/no settings, ...)
convex/                  Backend (deployed by `bunx convex dev`)
  schema.ts              All tables + indexes
  convex.config.ts       App config: typed deployment env vars (CADENCE_DEMO), read via `env`
  auth.ts                Convex Auth: Password provider, invite gate (email + one-time code),
                         inactive gate
  users.ts invites.ts settings.ts   Public functions (invites: list, create, renew (new code),
                         revoke; internal newCode for the CLI)
  features.ts            list, get, create, update (admin)
  tasks.ts               board (filters), get, mine, proposals, create, update (admin),
                         propose (anyone), approveProposal, declineProposal (admin)
  seed.ts                Internal seed mutation (CLI only); prints each new invite's code
  demo.ts                Dev-only demo data: demo:seed / demo:clear (CLI only; refuse to run
                         unless the deployment has CADENCE_DEMO=on)
  lib/                   Server helpers: auth (permissions), accounts, settings, activity,
                         validators (enums), errors, constants, dates (EVERY date helper:
                         GMT days, "Fri 14 Nov", "in 3 days"; shared with the app),
                         inviteCodes (shared with the app), tasks (task rules), views (shapes
                         sent to the app)
  tests/                 Vitest + convex-test
  test.setup.ts          Test helpers (never deployed: two dots in the name)
assets/fonts/            Montserrat (5 weights) and Anton (the holo card's wordmark), SIL OFL —
                         licences alongside; loaded in the root layout with expo-font
scripts/                 generate-auth-keys.mjs, generate-route-types.mjs
docs/                    Requirements
```

Aliases: `@/…` → `src/…`, `@convex/…` → `convex/…` (e.g. `@convex/_generated/api`).

## Conventions

**Backend (Convex)** — also read `convex/_generated/ai/guidelines.md` (see bottom of this file).

- **Permissions live in Convex functions, never only in the UI.** The first line of every public
  query/mutation is `requireUser(ctx)` or `requireAdmin(ctx)` from `convex/lib/auth.ts`
  (`users.me` is the one exception: it uses `getCurrentUser` so it can report a deactivated
  account). Use `requireAssignableUser(ctx, id)` before giving anyone work. Never take a user ID
  argument as proof of identity.
- **Roles:** `admin` | `member`; any number of admins. **Titles are free text** — never branch on
  "CEO"/"COO" etc. Team rules (who verifies admin-owned tasks, digest times, the late-extension
  window) live in the `settings` table, described in `convex/lib/settings.ts`.
- **Errors users may see:** `throw appError(code, message)` (`convex/lib/errors.ts`). The app
  shows `message` via `getErrorMessage` (`src/lib/errors.ts`). Plain `Error`s are hidden in prod.
- **Enums:** union-of-literal validators in `convex/lib/validators.ts`, snake_case values; add
  display labels in `src/constants/labels.ts`.
- **Audit:** every mutation that changes data calls `logActivity` (`convex/lib/activity.ts`).
  Deadlines, reviews, verifications and logs are never deleted.
- **Time:** points in time are ms timestamps; calendar dates are `"YYYY-MM-DD"` (GMT). A deadline
  picked as a date is stored as the end of that day in GMT. No `Date.now()` inside queries.
  Count days by GMT calendar day (`calendarDaysBetween`, `relativeDay` in `convex/lib/dates.ts`),
  never by dividing a time difference by 24 hours.
- **Queries:** use indexes (`by_a_and_b` naming), bounded reads (`.take(n)`/pagination), and the
  table-name forms `ctx.db.get("table", id)` / `patch` / `delete`.
- Emails are stored trimmed + lower-case (`normalizeEmail`).
- **Sign-up** needs the invited email **and** its one-time code (`convex/lib/inviteCodes.ts`),
  before the invite's `expiresAt` (`INVITE_DAYS`). Every refusal — no invite, wrong or expired
  code, already registered — shows the same `INVITE_REJECTED_MESSAGE`, so sign-up never reveals
  who is invited. Codes are cleared once used and never written to the activity log. The repos
  are public: never commit secrets, real emails or deployment names/URLs.
- **Ids from URLs:** queries that take an id from a route (`tasks.get`, `features.get`) accept
  `v.string()` and use `ctx.db.normalizeId`, returning null for a bad id instead of throwing.
- **Tasks:** `kind` (code/design/content/operations/other); code tasks need a peer reviewer who
  isn't the owner. Proposals (`status: "proposed"`) have no owner/deadline until an admin approves
  them (→ `"todo"`, `originalDeadline` set) or declines them (→ `"declined"` + `declineReason`,
  kept, never on the board). All task-plan rules live in `validateTaskPlan` (`convex/lib/tasks.ts`):
  active owner/reviewer, ≥1 acceptance criterion, deadline not past and ≤ the feature's. A
  feature's deadline can't move before its latest task deadline. Shipped features take no new work.

**App**

- Screens use `Screen` (safe area, scroll, max width for web) and HeroUI components; colours come
  from HeroUI theme tokens (`bg-background`, `useThemeColor("accent")`), so light/dark both work.
- Never import `convex/auth.ts`, `@convex-dev/auth/server` or other server-only modules into
  `src/` — Metro can't bundle them. Shared constants go in `convex/lib/constants.ts`.
- Read env vars as `process.env.EXPO_PUBLIC_…` (dot notation). No secrets in `EXPO_PUBLIC_*`.
- **Worklets** (`"worklet"` functions for Reanimated/Skia): define each one _before_ any worklet
  that calls it. The worklets Babel plugin turns them into `const`s that capture dependencies
  when defined, so a forward reference crashes at load ("Cannot access … before
  initialization") — on iOS and web alike.
- Animations must respect Reduce Motion (`useReducedMotion()` on native,
  `prefers-reduced-motion` on web).
- Don't call `Date.now()` during render (React Compiler lint rule): use `useNow()`
  (`src/lib/use-now.ts`), which also re-renders each minute so "Overdue" labels stay current.
- **Errors:** `src/app/(app)/_layout.tsx` exports an `ErrorBoundary` (black "Something went
  wrong" with Try again / Back to the Board) and anchors the stack on `(tabs)`, so pages opened
  straight from a link or a web refresh still have somewhere to go back to. After a save, forms
  go back if they can, else replace with the page they edited.
- Navigate with typed hrefs, e.g. `router.push({ pathname: "/tasks/[taskId]", params: { taskId } })`.
  Route types live in `.expo/types/router.d.ts`; **on Windows the dev server's watcher writes
  them wrong for files added while it runs** — `bun run typegen` (or a dev-server restart) fixes
  them, and `bun run typecheck` runs it first.
- Selects use `OptionPicker` (RN `Modal`), not HeroUI's Select, so they work on web too.
- **The Board** is always black with Montserrat stickers (`src/components/board/`), like the
  signed-out screens; other tabs follow the system theme. Bento tile sizes are reference points
  multiplied by `s = width / 402` (capped at 520 wide). Read Reanimated shared values with
  `.get()` / `.set()` (React Compiler friendly). The pit stop plays once when the Board first
  loads and when the feed is pulled past its top (iOS overscroll); Reduce Motion turns it off.
- **The feature, person and task pages** are black too: they hide the stack header and use
  `DetailPage` + `PageHeader` (back button, then the title). A feature's progress is
  `featureProgress` (`board-stats.ts`): the average of its live tasks' progress (verified = 100)
  plus the verified count. The Board's "next up" is the unshipped feature with the nearest
  deadline (else the most overdue) and opens the feature page. Countdowns tick with
  `useNow(1000)` inside `CountdownCard` only, so the rest of the page (and the Skia holo card)
  doesn't re-render every second.
- Prettier formats; ESLint (Expo + Convex + Prettier rules) must pass.

## How to run

**First-time setup**

1. `bun install`
2. `bunx convex dev` → log in, create/select the project. Writes `.env.local`
   (`CONVEX_DEPLOYMENT`, `EXPO_PUBLIC_CONVEX_URL`). Leave it running.
3. Auth signing keys (once per deployment): `node scripts/generate-auth-keys.mjs` then
   `bunx convex env set JWT_PRIVATE_KEY --from-file .auth-keys/jwt_private_key.txt` and
   `bunx convex env set JWKS --from-file .auth-keys/jwks.json`, then delete `.auth-keys/`.
   Add `--prod` for production.
4. Seed invites + default settings (PowerShell; args are JSON5 so single quotes work):
   ```
   bunx convex run seed:run "{invites:[{email:'coo@example.com',title:'COO',role:'admin'},{email:'ceo@example.com',title:'CEO',role:'member'}], adminTaskReviewerEmail:'ceo@example.com'}"
   ```
   Safe to re-run; existing users/invites/settings are skipped. The result lists each new
   invite's **one-time code**: send each person theirs (codes expire after 14 days). A pending
   invite without a code (made before codes existed), or a lost/expired code:
   `bunx convex run invites:newCode "{email:'coo@example.com'}"`, or New code on the Admin tab.
5. Optional, **dev only**: demo data so the Board has something to show. Switch it on for the
   dev deployment once: `bunx convex env set CADENCE_DEMO on` (never on prod; without it both
   commands refuse). Then `bunx convex run demo:seed` (3 demo people with `@demo.cadence.test`
   emails and no login, 3 features titled "Demo: …", 12 tasks across every status, spread over
   real users too) and `bunx convex run demo:clear` to remove it (only features a demo person
   created; the activity log is kept).

**Daily**

- `bun run convex` — Convex dev server (pushes `convex/` on save, regenerates `_generated`).
- `bun start` — Expo dev server; `w` for web. `bun run web` opens web directly.
- iOS: no Mac on the main dev machine, so no iOS Simulator. Use Expo Go (App Store, SDK 58) on
  an iPhone on the same Wi-Fi: sign in to the **same Expo account** in Expo Go and in the CLI.
  On Windows, `expo login`'s browser flow crashes (its `start` command splits the URL at `&`),
  so use `bunx expo login --no-browser`. If the phone can't connect, `bunx expo start --tunnel`.
- `bun run test` (Vitest + convex-test), `bun run lint`, `bun run typecheck`, `bun run format`.

## Phases

- [x] **Phase 1 — Foundation:** Expo (iOS + web) + Convex, schema for all tables, Convex Auth
      (email + password, invite-only), admin/member roles, permission helpers, settings, seed,
      app shell with tabs, offline banner, welcome screen (dots spell "cadence"). Real invites
      seeded on dev; real sign-up done; runs on iPhone via Expo Go. Branch `cadence-phase-1`.
- [ ] **Phase 2 — Features & tasks:** create/edit features and tasks with acceptance criteria
      (admin, web + phone), proposals + approval, owner/peer reviewer/deadline, shared board with
      filters, task detail. Branch `cadence-phase-2`; the bento Board + demo data on
      `cadence-phase-2-boardscreen`; the black task page on `cadence-phase-2-taskscreen`; the
      black feature + person pages and the feature "next up" on `cadence-phase-2-featurescreen`.
      _Built; server rules covered by tests. Tick once an admin and a member have walked through
      it on iPhone and web._
- [ ] **Phase 3 — Progress & extensions:** status changes, progress %, comments, overdue flag,
      extension requests + late rule, activity log.
- [ ] **Phase 4 — Daily logs:** weekday log form, weekend one-liner, history, missed weekdays.
- [ ] **Phase 5 — Peer review & verification:** peer review for code tasks, submit with proof,
      verification queue (admin task reviewer for admin-owned tasks), feature status rollup.
- [ ] **Phase 6 — Notifications & release:** push tokens, immediate pushes, digest + reminder
      crons, empty/loading/error states, EAS build to TestFlight, web deploy.

## Open decisions (carry forward)

- **App identity:** `app.json` still has the template's name/slug (`xolace_internal`) and scheme
  (`heroui-native-app`); the product name is "Cadence". An iOS bundle identifier is needed
  before EAS builds (Phase 6).
- **Known HeroUI-on-web issue:** in the web dev build, HeroUI's `Button` logs
  `[colorKit.RGB] … default color "black" will be used` (its JS colour parser can't read the
  `lab()`/`color-mix()` values theme variables resolve to on web), so the press highlight is
  black. Cosmetic, web-only; iOS is unaffected. Revisit if HeroUI adds web support.
- Phase 3 needs a stored overdue flag (set by a cron, since queries can't read the clock);
  Phase 4 needs a way to record missed weekdays. Add optional fields then.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
