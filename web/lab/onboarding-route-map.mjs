// Synthetic lab capture for issues/onboarding-route-map: the Kartta route
// beside the repository chooser, the Google step and the AI step after
// Google was skipped, on desktop and phone in light and dark. Run from the
// repository root with the lab up.
import { chromium } from "@playwright/test";
import { origin, snapshot } from "./session.mjs";

const out = "issues/onboarding-route-map";
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
  // The site's Google step, as root's admin CLI adds it.
  await fixture("onboarding?integrations=google");
  await fixture("scenario?value=pi-onboarding");
  await fixture("pi-state?value=missing");
  await page.goto(`${origin}/workspaces`);
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").nth(0).click();
  await page
    .getByTestId("git-identity-confirm")
    .or(page.getByTestId("git-identity-continue"))
    .click();
  await page.getByTestId("repository-list").waitFor();
  await page.getByTestId("onboarding-step-google").waitFor();
  await page.getByTestId("repository-fixture/first").check();
  await every("repositories");
  await page.getByTestId("repository-proceed").click();
  await page.getByTestId("integration-tile-google").waitFor();
  await every("google");
  await page.getByTestId("integration-onboarding-continue").click();
  await page.getByTestId("pi-sign-in-title").waitFor();
  await page.getByTestId("onboarding-clones").waitFor();
  await every("ai-after-google-skipped");
} finally {
  await browser.close();
}
