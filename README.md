# Cadence

Internal task and accountability app for the Xolace founding team: features, tasks, owners,
deadlines, daily logs and verification, on iOS and web.

- **Spec:** [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)
- **Working on the code (setup, conventions, phases):** [CLAUDE.md](CLAUDE.md)

## Quick start

```bash
bun install
bun run convex   # first run: log in to Convex and pick the project; writes .env.local
bun start        # Expo dev server; press w for web
```

First-time deployment setup (auth signing keys, seeding invites) is in
[CLAUDE.md → How to run](CLAUDE.md#how-to-run).

## Stack

- [Expo](https://docs.expo.dev/) SDK 58 + [Expo Router](https://docs.expo.dev/router/introduction)
  (routes in `src/app`), TypeScript strict, React Compiler
- [HeroUI Native](https://heroui.com/docs/native) components with
  [Uniwind](https://docs.uniwind.dev) (Tailwind CSS for React Native)
- [Convex](https://docs.convex.dev/) backend with [Convex Auth](https://labs.convex.dev/auth)
  (email + password, invite-only)
- bun, ESLint + Prettier, Vitest + convex-test
