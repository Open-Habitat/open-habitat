import { defineConfig, devices } from "@playwright/test";
import { labOrigin } from "./test-ports.mjs";

export default defineConfig({
  testDir: "./tests",
  testMatch: "lab-*.spec.ts",
  fullyParallel: true,
  workers: 4,
  globalSetup: "./tests/host-build.ts",
  globalTeardown: "./tests/host-teardown.ts",
  reporter: [["line"]],
  use: {
    baseURL: labOrigin,
    ignoreHTTPSErrors: true,
    ...devices["Desktop Chrome"],
  },
});
