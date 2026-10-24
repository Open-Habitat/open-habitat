import AxeBuilder from "@axe-core/playwright";
import type { Browser } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { confirmGitIdentity } from "./git-identity-helper";
import { expect, type Page, test } from "./worker-host";

// Palvelimen ylläpito › AI-avain against the real gateway handlers of the
// browser host. The administrator stores the key; Bob's first sign-in
// hands it to his synthetic daemon, whose native Pi helper (the pinned Pi SDK)
// writes it into his own auth.json. He still walks the site's route (Git
// identity, Repot, the integration steps) without the AI step, and once he has
// walked it his own first-route mark sends later loads to his workspaces. When
// the seed fails, his AI step offers every option. Same-UID synthetic
// evidence, not UID isolation; the fake Pi status follows the native write.

test.use({
  trace: "off",
  screenshot: "off",
  video: "off",
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
});

const key = `sk-ant-api03-${"S".repeat(40)}Xa1b`;

async function signIn(page: Page, nth: 0 | 1) {
  await page.goto("/");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(nth).click();
}
const segment = (page: Page, group: string, id: string) =>
  page
    .getByTestId(group)
    .getByRole("button")
    .and(page.getByTestId(`segment-${id}`));

/** Alice, the administrator, stores the site key on its own tab, which
 * Käyttöönotto's AI step links to. */
async function storeKey(page: Page) {
  await signIn(page, 0);
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeVisible();
  await page.goto("/settings/onboarding");
  await page
    .getByRole("button")
    .and(page.getByTestId("onboarding-route-ai"))
    .click();
  await segment(page, "onboarding-ai-way", "key").click();
  await page
    .getByRole("link")
    .and(page.getByTestId("site-key-page-link"))
    .click();
  await expect(page).toHaveURL(/\/settings\/ai-key$/);
  await segment(page, "site-key-provider", "anthropic").click();
  await page.getByTestId("site-key-input").fill(key);
  await page.getByRole("button").and(page.getByTestId("site-key-save")).click();
  await expect(page.getByTestId("site-key-suffix")).toContainText("Xa1b");
  const stored = await page.request.get("/api/v1/server/onboarding");
  const body = await stored.text();
  // Only the provider and suffix ever come back.
  expect(body).not.toContain(key.slice(0, 20));
  expect(JSON.parse(body)).toMatchObject({
    ai_account: { offer: "site_key" },
    site_key: { provider: "anthropic", suffix: "Xa1b" },
  });
  await page.getByTestId("settings-kayttoonotto").click();
  await page
    .getByRole("button")
    .and(page.getByTestId("onboarding-route-ai"))
    .click();
  await expect(page.getByTestId("onboarding-route-ai")).toHaveAttribute(
    "data-shown",
    "false",
  );
  await expect(page.getByTestId("site-key-suffix")).toContainText("Xa1b");
}

/** Bob's first sign-in. */
async function newPerson(browser: Browser) {
  const context = await browser.newContext({
    baseURL: hostOrigin,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  await signIn(page, 1);
  return page;
}

test("@site-ai-key @a11y a person seeded with the site key walks the route without the AI step", async ({
  page,
  browser,
}) => {
  await storeKey(page);
  // The AI-avain tab with a stored key fits a phone.
  await page.goto("/settings/ai-key");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("site-key-present")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
  expect(
    (
      await new AxeBuilder({ page })
        .include("[data-testid=site-key-page]")
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 1280, height: 800 });
  // The administrator's route also has an integration step.
  expect(
    (
      await page.request.get(
        "/fixture/onboarding?integrations=google&offer=site_key",
      )
    ).status(),
  ).toBe(204);
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  const bob = await newPerson(browser);
  await confirmGitIdentity(bob);
  await expect(bob.getByTestId("onboarding-step-google")).toBeVisible();
  await expect(bob.getByTestId("onboarding-step-ai")).toHaveCount(0);
  await bob
    .getByRole("button")
    .and(bob.getByTestId("repository-proceed"))
    .click();
  await expect(
    bob
      .getByRole("heading")
      .and(bob.getByTestId("integration-onboarding-title")),
  ).toBeVisible();
  await bob
    .getByRole("button")
    .and(bob.getByTestId("integration-onboarding-continue"))
    .click();
  // The route's last step passed, he lands in his workspaces with no AI step.
  await expect(
    bob.getByRole("heading").and(bob.getByTestId("workspaces-title")),
  ).toBeVisible();
  await expect(bob.getByTestId("pi-sign-in-title")).toHaveCount(0);
  // The copy is Bob's own native credential, read by his daemon.
  const own = await (await bob.request.get("/api/v1/pi/credentials")).json();
  expect(own).toMatchObject({ anthropic: { present: true, suffix: "Xa1b" } });
  // The finished route is his own state: a fresh load skips it.
  const mark = await (
    await bob.request.get("/api/v1/account/first-route")
  ).json();
  expect(mark).toMatchObject({ finished: true });
  await bob.reload();
  await expect(
    bob.getByRole("heading").and(bob.getByTestId("workspaces-title")),
  ).toBeVisible();
  await expect(bob.getByTestId("git-identity-title")).toHaveCount(0);
  await bob.context().close();
});

test("@site-ai-key a failed seed shows the AI step with every option", async ({
  page,
  browser,
}) => {
  await storeKey(page);
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  await page.request.get("/fixture/seed-fail?value=1");
  const bob = await newPerson(browser);
  await confirmGitIdentity(bob);
  await bob
    .getByRole("button")
    .and(bob.getByTestId("repository-proceed"))
    .click();
  await expect(
    bob.getByRole("heading").and(bob.getByTestId("pi-sign-in-title")),
  ).toBeVisible();
  // Every option, none of them the site's suggestion.
  const rows = bob.getByTestId("ai-options").getByRole("listitem");
  await expect(rows.filter({ visible: true })).toHaveCount(5);
  await expect(bob.getByTestId("ai-suggestion")).toHaveCount(0);
  const own = await (await bob.request.get("/api/v1/pi/credentials")).json();
  expect(own).toMatchObject({ anthropic: { present: false } });
  await bob.context().close();
  await page.request.get("/fixture/seed-fail?value=0");
  await page.request.get("/fixture/scenario?value=ready");
  await page.request.get("/fixture/pi-state?value=usable");
});
