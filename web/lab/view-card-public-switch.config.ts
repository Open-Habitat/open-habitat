import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

// Screenshots of the view card for issues/view-card-public-switch, against
// the synthetic browser host in lab mode with views. Run from web/:
// npx playwright test -c lab/view-card-public-switch.config.ts
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  testDir: here("."),
  testMatch: "view-card-public-switch.spec.ts",
  workers: 1,
  globalSetup: here("../tests/host-build.ts"),
  globalTeardown: here("../tests/host-teardown.ts"),
  reporter: [["line"]],
  use: { locale: "fi-FI", ...devices["Desktop Chrome"] },
});
