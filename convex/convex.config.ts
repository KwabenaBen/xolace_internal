import { defineApp } from "convex/server";
import { v } from "convex/values";

/**
 * The app's deployment settings. Environment variables declared here are typed on `env`
 * (import from "./_generated/server").
 */
const app = defineApp({
  env: {
    // "on" only on a dev deployment: lets demo:seed and demo:clear run (convex/demo.ts).
    //   bunx convex env set CADENCE_DEMO on
    CADENCE_DEMO: v.optional(v.string()),
  },
});

export default app;
