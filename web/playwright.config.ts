import { defineConfig, devices } from "@playwright/test";
import { ports, viteOrigin } from "./test-ports.mjs";
export default defineConfig({
  testDir: "./tests",
  testIgnore: ["synthetic-demo.spec.ts", "lab-*.spec.ts"],
  fullyParallel: true,
  workers: 8, // Each slot starts an independent synthetic host.
  retries: 0,
  globalSetup: "./tests/host-build.ts",
  reporter: [["line"]],
  use: { baseURL: viteOrigin, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${ports.vite} --strictPort`,
      url: viteOrigin,
      reuseExistingServer: false,
      env: { VITE_ENABLE_TEST_FIXTURES: "true" },
    },
  ],
});
