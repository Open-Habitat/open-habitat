import { defineConfig, devices } from "@playwright/test";
import { labOrigin } from "./test-ports.mjs";

export default defineConfig({
  testDir: "./tests",
  testMatch: "lab-*.spec.ts",
  // A concurrent normal suite owns the default test-results directory.
  outputDir: "./test-results-lab",
  fullyParallel: true,
  workers: Number(process.env.OH_BROWSER_WORKERS ?? 4),
  globalSetup: "./tests/host-build.ts",
  globalTeardown: "./tests/host-teardown.ts",
  reporter: [["line"]],
  use: {
    baseURL: labOrigin,
    ignoreHTTPSErrors: true,
    ...devices["Desktop Chrome"],
  },
});
