import { defineConfig } from "vitest/config";

// Only Convex function tests for now; they run in the edge-runtime like Convex itself.
export default defineConfig({
  test: {
    include: ["convex/**/*.test.ts"],
    environment: "edge-runtime",
  },
});
