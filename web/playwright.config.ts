import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testIgnore: "synthetic-demo.spec.ts",
  globalTeardown: "./tests/host-teardown.ts",
  fullyParallel: false,
  workers: 1, // Standalone host scenario switch is shared by tests; never run it concurrently.
  retries: 0,
  reporter: [["line"]],
  use: { baseURL: "http://127.0.0.1:4183", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev -- --host 127.0.0.1 --port 4183",
      url: "http://127.0.0.1:4183",
      reuseExistingServer: false,
      env: { VITE_ENABLE_TEST_FIXTURES: "true" },
    },
    {
      command:
        'npm run build && cd .. && PATH="$PWD/.tools/go/bin:$PATH" go build -o .cache/browser-host ./test/browser-host && BROWSER_HOST_MARKER=web/test-results/browser-host-path exec .cache/browser-host web/dist',
      url: "https://127.0.0.1:4174/healthz",
      ignoreHTTPSErrors: true,
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
