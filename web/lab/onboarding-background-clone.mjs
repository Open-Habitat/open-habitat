// Synthetic lab capture for issues/onboarding-background-clone: the chooser
// with an unavailable catalog, and the AI step while clones run, on desktop
// and phone in light and dark. Run from the repository root with the lab up.
import { chromium } from "@playwright/test";
import { origin, snapshot } from "./session.mjs";

const out = "issues/onboarding-background-clone";
const sizes = { desktop: [1440, 1000], phone: [390, 844] };
const browser = await chromium.launch();
const page = await browser.newPage({
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 1000 },
});
const fixture = (path) => page.request.get(`${origin}/fixture/${path}`);
async function every(name) {
  for (const [size, [width, height]] of Object.entries(sizes))
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme: theme });
      // Let colour transitions finish before the capture.
      await page.waitForTimeout(600);
      await snapshot(page, `${out}/${name}-${size}-${theme}`);
    }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ colorScheme: "light" });
}
try {
  await fixture("scenario?value=pi-onboarding");
  await fixture("pi-state?value=missing");
  await fixture("checkout?name=first&mode=absent");
  await fixture("checkout?name=second&mode=conflict");
  await page.route("**/api/v1/onboarding/github/repos", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"error":"native_source_unavailable"}',
    }),
  );
  await page.goto(`${origin}/workspaces`);
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").nth(0).click();
  await page.getByTestId("repository-unavailable").waitFor();
  await every("chooser-unavailable");

  // The catalog again, then three repositories: one whose directory is
  // taken, one held mid-receive and one waiting its turn.
  await page.unrouteAll();
  await page
    .getByTestId("repository-unavailable")
    .getByTestId("notice-action")
    .click();
  const identity = page
    .getByTestId("git-identity-confirm")
    .or(page.getByTestId("git-identity-continue"));
  await identity.click();
  await page.getByTestId("repository-list").waitFor();
  await fixture("clone?mode=hold");
  await page.getByTestId("repository-fixture/second").check();
  await page.getByTestId("repository-fixture/first").check();
  await page
    .getByTestId("repository-list")
    .getByRole("checkbox")
    .nth(2)
    .check();
  await page.getByTestId("repository-proceed").click();
  await page.getByTestId("pi-sign-in-title").waitFor();
  await page
    .locator('[data-testid="onboarding-clone"][data-state="running"]')
    .getByRole("progressbar")
    .waitFor();
  await page.waitForTimeout(500);
  await every("ai-step-clones");
} finally {
  await fixture("clone?mode=normal");
  await fixture("checkout?name=first&mode=absent");
  await fixture("checkout?name=second&mode=absent");
  await browser.close();
}
