import { defineConfig, devices } from "@playwright/test";
import { demoOrigin } from "./test-ports.mjs";
export default defineConfig({
  testDir: "./tests",
  testMatch: "synthetic-demo.spec.ts",
  workers: 1,
  reporter: [["line"]],
  use: {
    // The suite reads the interface in Finnish; a spec that tests English
    // opens its own context in another locale.
    ...devices["Desktop Chrome"],
    locale: "fi-FI",
    baseURL: demoOrigin,
  },
  webServer: {
    command: "npm run demo",
    url: `${demoOrigin}/workspaces`,
    reuseExistingServer: false,
  },
});
