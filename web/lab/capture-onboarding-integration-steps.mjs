// Synthetic lab capture for issues/onboarding-integration-steps: the
// Käyttöönotto tab with a hidden (not ready) step and the add choice offering
// only ready integrations, its preview on the shared Kartta frame at a
// required step, and the person's own required step. Desktop and phone in
// light and dark. Run from the repository root with the lab up.
import { chromium } from "@playwright/test";
import { origin, snapshot } from "./session.mjs";

const out = "issues/onboarding-integration-steps";
const sizes = { desktop: [1440, 1000], phone: [390, 844] };
const browser = await chromium.launch();
const page = await browser.newPage({
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 1000 },
});
const fixture = async (path) => {
  const r = await page.request.get(`${origin}/fixture/${path}`);
  if (!r.ok()) throw new Error(`fixture ${path}: ${r.status()}`);
};
async function every(name, before = async () => {}) {
  for (const [size, [width, height]] of Object.entries(sizes))
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme: theme });
      await before();
      // Let colour transitions finish before the capture.
      await page.waitForTimeout(600);
      await snapshot(page, `${out}/${name}-${size}-${theme}`);
    }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ colorScheme: "light" });
}
try {
  // Google required, Microsoft optional, Dropbox configured but not ready.
  await fixture(
    "onboarding?integrations=google:required,microsoft,dropbox&mode=preselected",
  );
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
  await page.getByTestId("repository-proceed").click();
  await page.getByTestId("integration-onboarding").waitFor();
  await every("person-required");

  await fixture("scenario?value=ready");
  await fixture("pi-state?value=usable");
  await page.goto(`${origin}/settings/onboarding`);
  await page.getByTestId("onboarding-settings").waitFor();
  await page.getByTestId("onboarding-route-integration:dropbox").click();
  await every("tab-hidden");
  await page.getByTestId("onboarding-route-add-integration").click();
  await every("tab-add");
  await every("preview-required", async () => {
    if (!(await page.getByTestId("onboarding-preview").count())) {
      await page.getByTestId("onboarding-preview-open").click();
      await page.getByTestId("onboarding-preview-next").click();
    }
    await page
      .locator('[data-testid="onboarding-preview-screen"][data-at="google"]')
      .waitFor();
  });
} finally {
  await browser.close();
}
