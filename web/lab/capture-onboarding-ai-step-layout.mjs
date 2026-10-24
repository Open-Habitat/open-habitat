// Synthetic lab capture for issues/onboarding-ai-step-layout: the AI step as
// "Ehdotus ja lista" with ChatGPT, Claude and a key row open, while a clone
// is held mid-receive on the route's Repot row, on desktop and phone in light
// and dark. Run from the repository root with the lab up.
import { execFileSync } from "node:child_process";
import { unlink } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { origin, snapshot } from "./session.mjs";

const out = "issues/onboarding-ai-step-layout";
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
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.waitForTimeout(300);
      const base = `${out}/${name}-${size}-${theme}`;
      await snapshot(page, base);
      execFileSync(
        "avifenc",
        ["-j", "2", "-s", "8", "-q", "80", `${base}.png`, `${base}.avif`],
        { stdio: "ignore" },
      );
      await unlink(`${base}.png`);
    }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ colorScheme: "light" });
}
try {
  // The lab has no Claude runtime: synthetic provider replies only; the
  // production component, layout and styles run unchanged.
  await page.route("**/api/v1/pi/claude-login", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        state: "code",
        attempt_id: "20261020T120000.000000000",
        verification_uri: "https://claude.com/cai/oauth/authorize?synthetic=1",
      },
    }),
  );
  await fixture("scenario?value=pi-onboarding");
  await fixture("pi-state?value=missing");
  await fixture("checkout?name=first&mode=absent");
  await fixture("clone?mode=hold");
  await page.goto(`${origin}/workspaces`);
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").nth(0).click();
  await page
    .getByTestId("git-identity-confirm")
    .or(page.getByTestId("git-identity-continue"))
    .click();
  await page.getByTestId("repository-list").waitFor();
  await page.getByTestId("repository-fixture/first").check();
  await page.getByTestId("repository-proceed").click();
  const google = page.getByTestId("google-onboarding-continue");
  await google.or(page.getByTestId("pi-sign-in-title")).first().waitFor();
  if (await google.isVisible()) await google.click();
  await page.getByTestId("pi-sign-in-title").waitFor();
  await page
    .getByTestId("onboarding-clone")
    .and(page.locator('[data-state="running"]'))
    .waitFor();
  await page.getByTestId("pi-attempt-start").waitFor();
  await every("ai-chatgpt");
  await page.getByTestId("ai-option-claude-choose").click();
  await page.getByTestId("claude-code-input").waitFor();
  await every("ai-claude");
  await page.getByTestId("ai-option-key-anthropic-choose").click();
  await page
    .getByTestId("api-key-input")
    .fill("sk-proj-synthetic0000000000000");
  await page.getByRole("alert").waitFor();
  await every("ai-key-anthropic");
} finally {
  await fixture("clone?mode=normal").catch(() => {});
  await browser.close();
}
