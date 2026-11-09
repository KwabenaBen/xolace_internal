// Regenerates Expo Router's typed routes (.expo/types/router.d.ts) from a full scan of src/app.
//
// Why: on Windows, the dev server's file watcher writes wrong route types for files added while
// it's running (it keeps backslash paths, so "features/[featureId]/index" isn't recognised as
// "/features/[featureId]" and files outside src/app leak in). `bun run typecheck` runs this
// first; restarting the dev server also regenerates them correctly.
import { createRequire } from "node:module";
import path from "node:path";

process.env.EXPO_ROUTER_APP_ROOT = path.resolve("src/app");
const require = createRequire(import.meta.url);
require("@expo/router-server/build/typed-routes").regenerateDeclarations(".expo/types", {});
console.log("Regenerated .expo/types/router.d.ts");
