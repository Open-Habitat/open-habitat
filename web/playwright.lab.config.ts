import { defineConfig, devices } from "@playwright/test";
import { labOrigin } from "./test-ports.mjs";

import { stressTimeouts } from "./tests/stress-options";
export default defineConfig({
  ...stressTimeouts,
  testDir: "./tests",
  testMatch: "lab-*.spec.ts",
  // Separate from the ordinary suite's test-results, which that suite clears
  // when it starts: the gate runs both at once.
  outputDir: "./test-results-lab",
  fullyParallel: true,
  workers: Number(process.env.OH_BROWSER_WORKERS ?? 4),
  globalSetup: "./tests/host-build.ts",
  globalTeardown: "./tests/host-teardown.ts",
  reporter: [["line"]],
  use: {
    // The suite reads the interface in Finnish; a spec that tests English
    // opens its own context in another locale.
    locale: "fi-FI",
    reducedMotion: "reduce",
    baseURL: labOrigin,
    ignoreHTTPSErrors: true,
    ...devices["Desktop Chrome"],
  },
});
