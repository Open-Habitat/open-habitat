import { defineConfig, devices } from "@playwright/test";
import { hostOrigin, ports, viteOrigin } from "./test-ports.mjs";
export default defineConfig({
  testDir: "./tests",
  testIgnore: ["synthetic-demo.spec.ts", "lab-*.spec.ts"],
  globalTeardown: "./tests/host-teardown.ts",
  fullyParallel: false,
  workers: 1, // Standalone host scenario switch is shared by tests; never run it concurrently.
  retries: 0,
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
    {
      command: `${process.env.NAH_WEB_PREBUILT === "1" ? "" : "npm run build && "}cd .. && PATH="$PWD/.tools/go/bin:$PATH" go build -o .cache/browser-host ./test/browser-host && BROWSER_HOST_MARKER=web/test-results/browser-host-path exec .cache/browser-host web/dist`,
      url: `${hostOrigin}/healthz`,
      ignoreHTTPSErrors: true,
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
