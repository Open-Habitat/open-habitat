import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "synthetic-demo.spec.ts",
  workers: 1,
  reporter: [["line"]],
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:4184" },
  webServer: {
    command: "npm run demo",
    url: "http://127.0.0.1:4184/workspaces",
    reuseExistingServer: false,
  },
});
