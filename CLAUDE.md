# Cadence

Internal task and accountability app for the four cofounders (CEO, CTO, CMO/CDO, COO). Every
task has one owner and one deadline, everyone sees everything, daily work is logged, and nothing
is done until it is verified. **Full spec: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) — read it
before starting a phase.**

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
  (app)/                 Tabs: Board (index), My Tasks, Logs, Profile, Admin (admins only)
src/components/          Shared UI (Screen, PlaceholderScreen, OfflineBanner, ...)
  auth/                  Signed-out UI: DotField (dots that spell "cadence"; dot-field.tsx = Skia,
                         dot-field.web.tsx = canvas, math in dot-formations.ts), DotWordmark,
                         PillButton, AuthTextField, AuthFormScreen
src/constants/           theme.ts (spacing/layout/type tokens), labels.ts (enum display labels)
src/lib/                 Convex client, auth token storage, error messages, hooks
convex/                  Backend (deployed by `bunx convex dev`)
  schema.ts              All tables + indexes
  auth.ts                Convex Auth: Password provider, invite gate, inactive gate
  users.ts invites.ts settings.ts   Public functions
  seed.ts                Internal seed mutation (CLI only)
  lib/                   Server helpers: auth (permissions), accounts, settings, activity,
                         validators (enums), errors, constants
  tests/                 Vitest + convex-test
  test.setup.ts          Test helpers (never deployed: two dots in the name)
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
- **Queries:** use indexes (`by_a_and_b` naming), bounded reads (`.take(n)`/pagination), and the
  table-name forms `ctx.db.get("table", id)` / `patch` / `delete`.
- Emails are stored trimmed + lower-case (`normalizeEmail`).

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
   Safe to re-run; existing users/invites/settings are skipped.

**Daily**

- `bun run convex` — Convex dev server (pushes `convex/` on save, regenerates `_generated`).
- `bun start` — Expo dev server; `w` for web. `bun run web` opens web directly.
- iOS: no Mac on the main dev machine, so no iOS Simulator. Expo Go on the App Store supports
  SDK 57 until its SDK 58 update ships; otherwise use an EAS development build (see Open decisions).
- `bun run test` (Vitest + convex-test), `bun run lint`, `bun run typecheck`, `bun run format`.

## Phases

- [ ] **Phase 1 — Foundation:** Expo (iOS + web) + Convex, schema for all tables, Convex Auth
      (email + password, invite-only), admin/member roles, permission helpers, settings, seed,
      app shell with tabs, offline banner. _Built and verified (tests, lint, typecheck, iOS + web
      bundles, web smoke test); the four real invites and default settings are seeded on the dev
      deployment. Tick once a real sign-up works and the app has run on an iPhone._
- [ ] **Phase 2 — Features & tasks:** create/edit features and tasks with acceptance criteria
      (admin, web + phone), proposals + approval, owner/peer reviewer/deadline, shared board with
      filters, task detail.
- [ ] **Phase 3 — Progress & extensions:** status changes, progress %, comments, overdue flag,
      extension requests + late rule, activity log.
- [ ] **Phase 4 — Daily logs:** weekday log form, weekend one-liner, history, missed weekdays.
- [ ] **Phase 5 — Peer review & verification:** peer review for code tasks, submit with proof,
      verification queue (admin task reviewer for admin-owned tasks), feature status rollup.
- [ ] **Phase 6 — Notifications & release:** push tokens, immediate pushes, digest + reminder
      crons, empty/loading/error states, EAS build to TestFlight, web deploy.

## Open decisions (carry forward)

- **iOS testing route** without a Mac: EAS development build (recommended), wait for Expo Go
  SDK 58, or `eas go`. Needs an iOS bundle identifier in `app.json`.
- **App identity:** `app.json` still has the template's name/slug (`xolace_internal`) and scheme
  (`heroui-native-app`); the product name is "Cadence".
- **Code tasks:** currently "a task with a `peerReviewerId`". A task `kind` field was proposed
  but not approved.
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
