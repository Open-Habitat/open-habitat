import { defineConfig, devices } from "@playwright/test";
import { labOrigin } from "./test-ports.mjs";

export default defineConfig({
  testDir: "./tests",
  testMatch: "lab-*.spec.ts",
  workers: 1,
  reporter: [["line"]],
  use: {
    baseURL: labOrigin,
    ignoreHTTPSErrors: true,
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `${process.env.OH_WEB_PREBUILT === "1" ? "" : "npm run build && "}cd .. && PATH="$PWD/.tools/go/bin:$PATH" go build -o .cache/browser-host ./test/browser-host && BROWSER_HOST_LAB=1 exec .cache/browser-host web/dist`,
    url: `${labOrigin}/healthz`,
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
