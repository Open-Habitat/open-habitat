// Synthetic lab capture for issues/onboarding-config-store: Asetukset ›
// Käyttöönotto and its preview mode on desktop and phone in light and dark.
// Run from the repository root with the lab up.
import { chromium } from "@playwright/test";
import { origin, snapshot } from "./session.mjs";

const out = "issues/onboarding-config-store";
const sizes = { desktop: [1440, 1000], phone: [390, 844] };
const browser = await chromium.launch();
const page = await browser.newPage({
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 1000 },
});
async function every(name, before = async () => {}) {
  for (const [size, [width, height]] of Object.entries(sizes))
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme: theme });
      await before();
      await page.waitForTimeout(600);
      await snapshot(page, `${out}/${name}-${size}-${theme}`);
    }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ colorScheme: "light" });
}
try {
  await page.goto(`${origin}/workspaces`);
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").nth(0).click();
  await page.getByTestId("account-menu-trigger").waitFor();
  const { csrf } = await (
    await page.request.get(`${origin}/auth/session`)
  ).json();
  const current = await (
    await page.request.get(`${origin}/api/v1/server/onboarding`)
  ).json();
  const put = await page.request.put(`${origin}/api/v1/server/onboarding`, {
    headers: {
      Origin: origin,
      "X-Agent-Host-CSRF": csrf,
      "Content-Type": "application/json",
    },
    data: {
      expected_version: current.version,
      repositories: {
        mode: "preselected",
        defaults: [
          "example-org/product",
          "example-org/design-system",
          "example-org/infra",
        ],
      },
      integrations: [
        { provider: "google", required: false },
        { provider: "microsoft", required: true },
        { provider: "dropbox", required: false },
      ],
      ai_account: { offer: "chatgpt" },
    },
  });
  if (!put.ok()) throw new Error(`seed failed: ${put.status()}`);
  await page.goto(`${origin}/settings/onboarding`);
  await page.getByTestId("onboarding-settings").waitFor();
  await every("tab-repositories");
  await page.getByTestId("onboarding-route-integration:microsoft").click();
  await every("tab-integration");
  await page.getByTestId("onboarding-route-ai").click();
  await every("tab-ai");
  await page.getByTestId("onboarding-route-repositories").click();
  await every("preview", async () => {
    if (!(await page.getByTestId("onboarding-preview").count()))
      await page.getByTestId("onboarding-preview-open").click();
    await page.getByTestId("onboarding-preview-screen").waitFor();
  });
  await page.getByTestId("onboarding-preview-close").click();
} finally {
  await browser.close();
}
