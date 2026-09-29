import { defineConfig, devices } from "@playwright/test";
import { demoOrigin } from "./test-ports.mjs";
export default defineConfig({
  testDir: "./tests",
  testMatch: "synthetic-demo.spec.ts",
  workers: 1,
  reporter: [["line"]],
  use: { ...devices["Desktop Chrome"], baseURL: demoOrigin },
  webServer: {
    command: "npm run demo",
    url: `${demoOrigin}/workspaces`,
    reuseExistingServer: false,
  },
});
