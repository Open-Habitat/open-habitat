import { defineConfig, devices } from "@playwright/test";
import { ports, viteOrigin } from "./test-ports.mjs";
import { stressTimeouts } from "./tests/stress-options";
export default defineConfig({
  ...stressTimeouts,
  testDir: "./tests",
  testIgnore: ["synthetic-demo.spec.ts", "lab-*.spec.ts"],
  fullyParallel: true,
  workers: Number(process.env.OH_BROWSER_WORKERS ?? 8), // Each slot starts an independent synthetic host.
  retries: 0,
  globalSetup: "./tests/host-build.ts",
  globalTeardown: "./tests/host-teardown.ts",
  reporter: [["line"]],
  use: {
    // The suite reads the interface in Finnish; a spec that tests English
    // opens its own context in another locale.
    locale: "fi-FI",
    reducedMotion: "reduce",
    baseURL: viteOrigin,
    trace: "retain-on-failure",
  },
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
