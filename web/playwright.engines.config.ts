import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

// The specs whose evidence depends on how each browser engine enforces a
// security header, run in Firefox and WebKit as well. The ordinary suite
// stays Chromium-only. WebKit needs its system libraries (`npx playwright
// install-deps webkit`); without them its project fails to launch.
export default defineConfig({
  ...base,
  testMatch: ["view-frames.spec.ts"],
  testIgnore: [],
  outputDir: "./test-results-engines",
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
