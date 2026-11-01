/// <reference types="node" />
import type { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      // CONVEX_SITE_URL is built in to every deployment; it is not set by hand.
      domain: process.env.CONVEX_SITE_URL!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
