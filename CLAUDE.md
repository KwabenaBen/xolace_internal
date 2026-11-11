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
  is officially "not recommended for web"; check every new screen on web too. **Two themes:**
  black and a warm off-white (`#FEFAF3`), following the phone's dark/light setting
  (`src/global.css`). Bespoke screens (sign-in, Board, detail pages) use RN primitives + the
  shared kit in `src/components/ui/`.
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
  (auth)/                welcome → sign-in / sign-up (signed-out only)
  (app)/_layout.tsx      Stack: loads the user, then (tabs) + pages + modal forms
  (app)/(tabs)/          Tabs: Board (index), My Tasks, Logs, Settings, Admin (admins only)
  (app)/settings/        Pages under Settings: account (profile + sign out), people/index (the
                         team grid, invites waiting, deactivated; person cards), people/invite
                         (modal: invite with a live ticket, then the code to share), team-rules
                         (the team's settings; admins change each in a SaveSheet)
  (app)/features/        new (modal), [featureId]/index (page), [featureId]/edit (modal),
                         [featureId]/people/[userId] (one person's work on the feature)
  (app)/tasks/           new (modal: admin creates / member proposes), [taskId]/index (page),
                         [taskId]/edit (modal: edit a live task, or approve a proposal)
  (app)/board/[view].tsx The Board's tile pages: due-this-week, overdue, waiting
  (app)/activity.tsx     The team's activity (from the Board's red hero tile), by day, by person
src/components/          Shared UI (Screen, PlaceholderScreen, OfflineBanner, ErrorScreen (the signed-in
                         area's error boundary), ...)
  ui/                    The shared kit, used across screens: theme.ts (usePageColors: the
                         theme's page colours; `colors`: sticker palette; fonts, FONT_FILES,
                         STATUS_COLORS), pill-button.tsx (PillButton, PillRow), page-header.tsx
                         (PageHeader with an optional action, RoundButton), detail-page.tsx
                         (DetailPage, usePageSize, useGoBack), panel.tsx (Panel, SectionTitle),
                         task-row.tsx (TaskRow,
                         StatusPill, FeatureStatusPill), progress-bar.tsx, sym.tsx (SF Symbol /
                         Material icon), sheet.tsx (Sheet: every overlay card; SheetScrollView,
                         SheetNoSwipe, useSheet), save-sheet.tsx (SaveSheet: fields, then Save),
                         action-sheet.tsx (ActionSheet), use-sheet-actions.ts
                         (confirm-in-sheet), role-pill.tsx (RolePill)
  settings/              The Settings tab: ClayRelightSettings.tsx (Native Cook's "Clay Relight
                         Settings": a Skia ray-marched clay scene relit from noon to night by the
                         Dark mode switch, crs-hero-shader.ts / crs-icon-shader.ts / crs-motion.ts /
                         crs-theme.ts; .web.tsx = flat version without Skia), use-settings-rows.ts
  people/                The People page: team-grid.tsx, list-row.tsx, avatar.tsx (pastel
                         initials), person-card.tsx (the editorial card, in a Sheet),
                         stickers.tsx (SVG stickers + pen marks), person-actions.ts /
                         invite-actions.ts (what an admin can do, mirroring the server's rules),
                         invite-form.tsx + invite-ticket.tsx
  team-rules/            Team rules: rules.ts (labels, "HH:mm" ↔ Date, who the reviewer is),
                         rule-row.tsx,
                         rule-sheets.tsx (TimeRuleSheet, ReviewerSheet, LateWindowSheet; the time
                         sheet is also opened from the Settings rows), time-picker.tsx (iOS
                         wheel / Android dialog; .web.tsx = browser time input)
  auth/                  Signed-out UI: DotField (dots that spell "cadence"; dot-field.tsx = Skia,
                         dot-field.web.tsx = canvas, math in dot-formations.ts), DotWordmark,
                         AuthTextField, AuthFormScreen
  planning/              Forms: OptionPicker (a select in a Sheet), ChoiceChips, CriteriaEditor,
                         DateField (iOS: calendar in a Sheet with Done; .web.tsx = browser date
                         input), FeatureForm, TaskForm, useUnsavedGuard ("Discard changes?"),
                         HeaderCancel, AdminOnly, FormError, NotFound
  board/                 The Board's bento (after Native Cook's "Paddock Widget Bento"):
                         board-theme.ts (sizes in points on a 402-wide screen, ×s), pit-stop.ts
                         (the fling-out/slam-back motion, worklets), bento.tsx, bento-tile.tsx,
                         board-stats.ts, board-lists.ts (the tile pages' data), feature-feed.tsx
  feature/               The feature and person pages: feature-team.ts (who's on a feature),
                         person-work.tsx (summary card, task card with criteria)
  task/                  The task page's parts: holo-card.tsx (Skia: the tilting status card, after Native
                         Cook's "Holo Cash Card"; .web.tsx = still SVG; holo-shared.ts),
                         countdown-card.tsx + odometer.tsx (rolling digits), people-cards.tsx,
                         task-panels.tsx, criteria-list.tsx, task-actions.tsx (admin's +
                         OwnerActions), update-sheet.tsx + progress-slider.tsx (the owner's
                         update; the drag bar), extension-sheet.tsx (ask for more time),
                         extension-panel.tsx (a waiting request; the decider's buttons,
                         Withdraw for the asker), deciders.ts (who decides, in words),
                         task-history.tsx (the task's history + comment box),
                         week-strip.tsx (unused; parked for Phase 5's daily logs),
                         task-dates.ts (countdown maths), task-theme.ts (holo words),
                         task-symbols.ts
  activity/              describe.ts (an activity entry as a sentence; timeAgo), activity-row.tsx
                         (one entry: avatar, sentence, comment bubble or quote); the task folder's
                         extension-row.tsx lists waiting requests (Admin, My Tasks, waiting page)
  web/                   The website layout (a browser window ≥ 1000 px wide: `useIsDesktop`,
                         src/lib/use-desktop.ts): web-theme.ts (type sizes, sidebar widths),
                         sidebar.web.tsx (replaces the tab bar; GSAP slide and collapsed
                         tooltips; sidebar.tsx is the app's empty stub), liquid-button.web.tsx
                         (the "liquid arrow" Open button: SVG goo filter + GSAP; .tsx = plain
                         fallback), motion.web.ts (useHoverLift; motion.ts = no-op),
                         use-hover.ts, board/ (the computer's Board, after the
                         "Learnify" Pinterest dashboard: web-board.tsx, board-header.tsx (search),
                         feature-card.tsx, coming-up-table.tsx, next-up-card.tsx, glance-card.tsx,
                         board-filter.ts (owner/status/search filters, in the browser))
src/constants/           theme.ts (spacing/layout/type tokens), labels.ts (enum display labels)
src/lib/                 Convex client, auth token storage, theme-preference (the Dark mode
                         switch's choice, remembered per device), error messages, hooks (useNow, useDeviceFlag for
                         per-device yes/no settings, useReduceTransparency, useAnnounce
                         (read an error out with VoiceOver), useKeyboardShown, ...)
convex/                  Backend (deployed by `bunx convex dev`)
  schema.ts              All tables + indexes
  convex.config.ts       App config: typed deployment env vars (CADENCE_DEMO), read via `env`
  auth.ts                Convex Auth: Password provider, invite gate (email + one-time code),
                         inactive gate
  users.ts invites.ts settings.ts   Public functions (invites: list, create, renew (new code),
                         revoke; internal newCode for the CLI)
  features.ts            list, get, create, update (admin)
  tasks.ts               board (filters; unshipped features unless one is picked), waitingCount,
                         get, mine, proposals, create, update (admin),
                         propose (anyone), approveProposal, declineProposal (admin),
                         postUpdate (owner: status, progress, note)
  extensions.ts          request (owner), decide (admins; the admin task reviewer for an
                         admin's own task), withdraw (the asker), forTask (with canRequest),
                         pending (all waiting, with canDecide)
  comments.ts            add (anyone; no edit/delete: part of the record)
  activity.ts            feed (paginated; invites hidden from members), forTask (a task's history)
  overdue.ts + crons.ts  flag: hourly job that sets tasks.overdueSince once a deadline passes
  seed.ts                Internal seed mutation (CLI only); prints each new invite's code
  demo.ts                Dev-only: demo:seed / demo:clear (demo data), demo:setRole (make an
                         account admin or member) (CLI only; refuse to run unless the deployment
                         has CADENCE_DEMO=on)
  lib/                   Server helpers: auth (permissions), accounts, settings, activity,
                         validators (enums), errors, constants, dates (EVERY date helper:
                         GMT days, "Fri 14 Nov", "in 3 days"; shared with the app),
                         inviteCodes (shared with the app), tasks (task rules), views (shapes
                         sent to the app), extensions (who decides), lateRule (the late rule;
                         shared with the app)
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
  who is invited. An email that already has an account is refused before Convex Auth sees the
  sign-up (`refuseSignUpForExistingAccounts`, convex/auth.ts): the library would otherwise check
  the password there with no attempt limit and sign the person in on a match. It wraps the
  provider's `options.authorize` (a library internal): re-run convex/tests/auth.test.ts after any
  Convex Auth upgrade. Codes are cleared once used and never written to the activity log; never
  set `AUTH_LOG_LEVEL=DEBUG` on prod (the library would log the sign-up profile, code included).
  Deactivating someone ends every session they had (newest first; the rest by
  `users.finishSigningOut`). The team time zone can't be changed from the app (dates are GMT).
  The repos are public: never commit secrets, real emails or deployment names/URLs.
- **Ids from URLs:** queries that take an id from a route (`tasks.get`, `features.get`) accept
  `v.string()` and use `ctx.db.normalizeId`, returning null for a bad id instead of throwing.
- **Tasks:** `kind` (code/design/content/operations/other); code tasks need a peer reviewer who
  isn't the owner. Proposals (`status: "proposed"`) have no owner/deadline until an admin approves
  them (→ `"todo"`, `originalDeadline` set) or declines them (→ `"declined"` + `declineReason`,
  kept, never on the board). All task-plan rules live in `validateTaskPlan` (`convex/lib/tasks.ts`):
  active owner/reviewer, ≥1 acceptance criterion, deadline not past and ≤ the feature's. A
  feature's deadline can't move before its latest task deadline. Shipped features take no new work.
  `tasks.update` also refuses: a plan change while the task is in peer review, submitted or
  verified (`isPlanLocked`, `convex/lib/validators.ts`, shared with the app), and any deadline
  change on a task an admin owns (before or after the edit): that's for requests for more time.
  A started task (`hasStarted`: past to do, any progress, or overdue) moved later needs
  `deadlineChangeType` and gets `isLateExtension`, like an approved extension; earlier, or while
  still planning, is free.
- **Progress (Phase 4):** only a task's owner posts updates (`tasks.postUpdate`): status between
  to do / in progress / blocked (blocked needs a note), progress 0–100, while the task is in their
  hands (`isOwnerWorking`: those three + changes requested). **Extensions:** the owner asks
  (one pending at a time, a later date, a reason, scope change / other); admins decide, but on an
  admin-owned task the admin task reviewer does, or the other admins when the reviewer can't
  (none set, deactivated, or it's their own task), and nobody decides their own (`loadDeciders`,
  `convex/lib/extensions.ts`); asking is refused when nobody could decide (`hasDecider`). Approving needs the request to come from the current owner, the task in their
  hands and the feature unshipped; it moves the deadline (the original is kept), moves the
  feature's too if the date is later, clears `overdueSince` and applies `isLateExtension` with the
  window saved on the request (`convex/lib/lateRule.ts`; `countsAsLate` never goes back to
  false). A change of owner closes any waiting request (status `withdrawn`). Members never see
  the email of a person a setting names before they joined (`hidePendingEmail`).
- **Activity entries about a task carry `taskId`** (its changes, comments, extension requests,
  a feature moved by its extension), which is how `activity.forTask` finds them. Comments are
  read from the activity log, not the `comments` table.

**App**

- **Theme switch:** Settings → Dark mode overrides the phone and is remembered on the device
  (`src/lib/theme-preference.ts`: `chooseTheme`, `applySavedTheme` at start-up, `useIsDarkTheme`).
  It goes through Uniwind (`Uniwind.setTheme`), so read the current theme with `useUniwind()` /
  `usePageColors().scheme`, never React Native's `useColorScheme` (that's the phone, and on web it
  ignores the switch).
- **Themes:** every colour that changes with the theme is a HeroUI variable in `src/global.css`
  (light `#FEFAF3` page / black text; dark black page / `#FEFAF3` text; plain hex only). Use
  classes (`bg-background`, `text-muted`, `bg-surface`) or, for inline styles,
  `usePageColors()` (`src/components/ui/theme.ts`). Never hard-code page black/white. Sticker
  colours (Board tiles, status pills, pastel cards, the holo card) stay the same in both themes,
  with ink that passes 4.5:1 on them.
- Tab screens use `Screen` (safe area, scroll, max width for web) and HeroUI components; lists of
  tasks use the shared `TaskRow`; section headings `SectionTitle`; buttons on bespoke screens
  `PillButton` (`primary` / `secondary`).
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
- **Errors:** `src/app/(app)/_layout.tsx` exports an `ErrorBoundary` ("Something went
  wrong" with Try again / Back to the Board) and anchors the stack on `(tabs)`, so pages opened
  straight from a link or a web refresh still have somewhere to go back to. After a save, forms
  go back if they can, else replace with the page they edited.
- Navigate with typed hrefs, e.g. `router.push({ pathname: "/tasks/[taskId]", params: { taskId } })`.
  Route types live in `.expo/types/router.d.ts`; **on Windows the dev server's watcher writes
  them wrong for files added while it runs** — `bun run typegen` (or a dev-server restart) fixes
  them, and `bun run typecheck` runs it first.
- Selects use `OptionPicker` (a `Sheet`), not HeroUI's Select, so they work on web too.
- **Overlays:** every overlay card is a `Sheet` (`src/components/ui/sheet.tsx`). Mount it to open
  it; it rises over the page, which blurs (expo-blur) and dims; swipe down, a tap outside or back
  closes it with the same exit, then `onClose` unmounts it. Scrolling content goes in
  `SheetScrollView` (a swipe scrolls first, then moves the card); a control that is dragged
  itself (the iOS time wheel) goes in `SheetNoSwipe`; content closes it with
  `useSheet().close` and locks it with `setLocked(busy)` while saving. Ask "are you sure?"
  inside the sheet (`useSheetActions`), never with an `Alert` over it (iOS won't show an alert
  over a closing modal). Reduce Motion: fade; Reduce Transparency: plain dim.
- **Navigation motion:** pushed pages keep the native push and swipe back (from anywhere on iOS
  26); form modals are native iOS sheets (swipe down; `useUnsavedGuard` blocks the swipe and
  asks when there are changes); signing in/out cross-fades (root stack `animation: "fade"`);
  tabs shift (`animation: "shift"`, none with Reduce Motion). Web stacks don't animate.
- On web, inline `pointerEvents: "box-none"` is ignored (not CSS): put it in a `StyleSheet`.
- **Forms** (modals): `HeaderCancel` top left; `useUnsavedGuard(initial, values)` asks before
  discarding changes (Expo Router's `usePreventRemove`; call `markSaving()` before saving);
  errors show above the save button.
- **The Board**: Montserrat stickers on the theme's page (`src/components/board/`). Bento tile
  sizes are reference points
  multiplied by `s = width / 402` (capped at 520 wide). Read Reanimated shared values with
  `.get()` / `.set()` (React Compiler friendly). The pit stop plays once when the Board first
  loads and when the feed is pulled past its top (iOS overscroll); Reduce Motion turns it off.
- **The website layout** (`useIsDesktop()`: web and ≥ 1000 px; phones and the iPhone app are
  unchanged): `(app)/_layout.tsx` puts the `Sidebar` beside the stack and hides the tab bar; form
  screens open as dialogs (`Screen`'s `dialogTitle`; `transparentModal` keeps the page visible);
  a `Sheet` becomes a centred dialog; the Board route renders `WebBoard`. Layout breakpoints read
  the **window** width, never the sidebar's, and sizes are percentages/flex: the sidebar's glide
  then reflows the page in CSS alone. Don't drive layout from `onLayout` there (it re-renders React
  on every frame of the glide). **Web motion uses GSAP** (`gsap`, the user's choice), only in
  `*.web.ts(x)` files with a plain `.ts(x)` twin for the app, so GSAP never reaches the iPhone
  bundle (check the iOS export). On the web a React Native view's ref is its DOM node, which GSAP
  animates; once GSAP owns a style (a width, a transform, a shadow), React's style gives only its
  starting value and must not change it. One `gsap.context()` per component, reverted on
  unmount; start motion in the event handler, not after React re-renders; prefer ease-outs (an
  ease-in-out's slow start reads as lag). Every web screen must feel interactive: hover, focus
  and press states that ease in, never snap. Reduce Motion: set the end state at once.
- **The feature, person, task and tile pages** hide the stack header and use `DetailPage` +
  `PageHeader` (back button, then the title; the task and person pages' grey line links to the
  feature). A feature's progress is
  `featureProgress` (`board-stats.ts`): the average of its live tasks' progress (verified = 100)
  plus the verified count. The Board's "next up" is the unshipped feature with the nearest
  deadline (else the most overdue) and opens the feature page. Countdowns tick with
  `useNow(1000)` inside `CountdownCard` only, so the rest of the page (and the Skia holo card)
  doesn't re-render every second.
- Prettier formats; ESLint (Expo + Convex + Prettier rules) must pass.

## Definition of done (before every commit)

After every milestone, sprint, phase or batch of fixes, run a **strict full audit of the whole
system** (not just the changed files), then commit only if all of it is clean. If anything fails
or conflicts, don't commit: report it, fix it or ask. Push only when asked (to `origin`).

1. **Checks:** `bun run typecheck` (route types, app, backend), `bun run lint`,
   `bunx prettier --check .`, `bun run test`, `bunx expo-doctor`, and production builds:
   `bunx expo export --platform ios` and `--platform web` (to a temp folder).
2. **Dependencies:** `bun audit`: no new critical/high advisories in what ships in the app.
3. **Secrets:** scan the diff for keys, tokens, real email addresses and deployment names/URLs
   (the repos are public).
4. **Shaders:** if a Skia shader changed, compile it with CanvasKit (`node_modules/canvaskit-wasm`).
5. **Review the diff:** every public Convex function checks the caller first; data changes call
   `logActivity`; no page colours hard-coded (theme tokens / `usePageColors`); Reduce Motion and
   accessibility labels kept; web still works without Skia (`.web.tsx`).
6. **Docs in step:** `docs/FEATURES.md`, this file, and the shared guide when asked.
7. **No conflicts:** `git merge-tree --write-tree origin/main HEAD` exits 0 (merges cleanly).
8. **Report honestly:** what was verified, and what only an iPhone can confirm.

At the end of a phase, also run a full audit like the 9 Nov one (backend, app code, navigation and
UX, security) and write the findings up before moving on.

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
   `bunx convex run invites:newCode "{email:'coo@example.com'}"`, or New code on Settings → People.
5. Optional, **dev only**: demo data so the Board has something to show. Switch it on for the
   dev deployment once: `bunx convex env set CADENCE_DEMO on` (never on prod; without it both
   commands refuse). Then `bunx convex run demo:seed` (3 demo people with `@demo.cadence.test`
   emails and no login, 3 features titled "Demo: …", 12 tasks across every status, spread over
   real users too) and `bunx convex run demo:clear` to remove it (only features a demo person
   created; the activity log is kept; it refuses while no real account is an active admin, or
   while real work or the reviewer rule points at a demo person). To try the app as an admin or a member:
   `bunx convex run demo:setRole "{email:'you@example.com',role:'admin'}"` (and back with
   `role:'member'`).

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
      _Audit fixes: batches 1–3 on `cadence-phase-2-hardening`, `-themes`, `-fixes`._
- [ ] **Phase 3 — Settings:** the Settings tab built from Native Cook's "Clay Relight Settings"
      block (`src/components/settings/`): the Dark mode switch is the app theme (overrides the
      phone, remembered per device); five rows (Notifications, Daily log reminder, People, Team
      rules, Account & security) with clay icons; Account page (profile, sign out). Branch
      `cadence-phase-3-settings-screen`. People page (team grid, editorial person cards, invites
      with codes to share, roles, deactivate) and every overlay as a swipe-to-close Sheet over a
      blurred page: `cadence-phase-3-peoplescreen`. Team rules page (admin task reviewer,
      digest/reminder times on a time wheel, read-only time zone, late window) and the
      Notifications / Daily log reminder time sheets: `cadence-phase-3-teamrulesscreen`.
      End-of-phase audit done 10 Nov (System audit doc, "Phase 3 audit" tab); fixes on
      `cadence-phase-3-audit`, also brought into `cadence-phase-4`. _Built; iPhone checks done
      10 Nov. Tick once a member has walked through it too._
- [ ] **Phase 4 — Progress & extensions:** owners' updates (status, a drag bar for progress, a
      note; blocked needs one), comments and each task's history, the hourly overdue flag,
      requests for more time (admins decide; the admin task reviewer for an admin's own task, or
      the other admins when the reviewer can't; withdraw) with the late rule, direct deadline
      moves judged by the same rule, the Activity page (from the Board's red tile), and requests
      on the Admin tab, My Tasks and the waiting tile. Branch `cadence-phase-4` (includes Phase
      3's audit fixes); end-of-phase audit in the System audit doc's "Phase 4 audit" tab.
      _Built; iPhone checks of the drag bar and the update card with the keyboard done 10 Nov.
      Tick once an admin and a member have walked through it on iPhone and web._
- [ ] **Phase 5 — Daily logs:** weekday log form, weekend one-liner, history, missed weekdays.
- [ ] **Phase 6 — Peer review & verification:** peer review for code tasks, submit with proof,
      verification queue (admin task reviewer for admin-owned tasks), feature status rollup.
- [ ] **Phase 7 — Notifications & release:** push tokens, immediate pushes, digest + reminder
      crons, empty/loading/error states, EAS build to TestFlight, web deploy.

## Open decisions (carry forward)

- **App identity:** `app.json` still has the template's name/slug (`xolace_internal`) and scheme
  (`heroui-native-app`); the product name is "Cadence". An iOS bundle identifier is needed
  before EAS builds (Phase 7).
- **Known HeroUI-on-web issue:** in the web dev build, HeroUI's `Button` logs
  `[colorKit.RGB] … default color "black" will be used` (its JS colour parser can't read the
  `lab()`/`color-mix()` values theme variables resolve to on web), so the press highlight is
  black. Cosmetic, web-only; iOS is unaffected. Revisit if HeroUI adds web support.
- Phase 5 needs a way to record missed weekdays (add optional fields then; the overdue flag
  is done: `tasks.overdueSince`, set by `convex/overdue.ts`).

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
