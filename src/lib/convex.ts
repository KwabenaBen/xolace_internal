import { ConvexReactClient } from "convex/react";

// Written to .env.local by `bunx convex dev`. Only EXPO_PUBLIC_* vars reach the app,
// and they must be read with dot notation so Expo can inline them.
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error(
    "EXPO_PUBLIC_CONVEX_URL is not set. Run `bunx convex dev` once to create .env.local (see .env.example)."
  );
}

export const convex = new ConvexReactClient(convexUrl, {
  // The web build would otherwise warn on every reload while a mutation is in flight.
  unsavedChangesWarning: false,
});
