const expoConfig = require("eslint-config-expo/flat");
const prettierRecommended = require("eslint-plugin-prettier/recommended");
const convexPlugin = require("@convex-dev/eslint-plugin");

// Loaded via require(), the Convex plugin exposes its legacy (eslintrc) config;
// reuse its recommended rule set in a flat-config block.
const convexRecommended = convexPlugin.configs.recommended;
const convexRules = Array.isArray(convexRecommended)
  ? convexRecommended[0].rules
  : convexRecommended.overrides[0].rules;

module.exports = [
  ...expoConfig,
  prettierRecommended,
  {
    files: ["convex/**/*.ts"],
    plugins: { "@convex-dev": convexPlugin },
    rules: convexRules,
  },
  {
    // auth.config.ts reads the built-in CONVEX_SITE_URL; tests set Convex Auth's env vars.
    files: ["convex/auth.config.ts", "convex/test.setup.ts", "convex/**/*.test.ts"],
    rules: { "@convex-dev/no-process-env": "off" },
  },
  {
    ignores: [
      "dist/*",
      ".expo/*",
      "node_modules/*",
      "expo-env.d.ts",
      "uniwind-types.d.ts",
      "convex/_generated/*",
    ],
  },
];
