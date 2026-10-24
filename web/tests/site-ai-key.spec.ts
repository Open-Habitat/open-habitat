import type { Browser } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { confirmGitIdentity } from "./git-identity-helper";
import { expect, type Page, test } from "./worker-host";

// Käyttöönotto › AI-tili › Sivuston avain against the real gateway handlers of
// the browser host. The administrator stores the key; Bob's first sign-in
// hands it to his synthetic daemon, whose native Pi helper (the pinned Pi SDK)
// writes it into his own auth.json, and since usable native credentials end
// onboarding he lands in his workspaces. When the seed
// fails, his AI step offers every option. Same-UID synthetic evidence, not UID
// isolation; the fake Pi status follows the native write.

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

/** Alice, the administrator, stores the site key in Käyttöönotto. */
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
  await expect(page.getByTestId("onboarding-route-ai")).toHaveAttribute(
    "data-shown",
    "false",
  );
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

test("@site-ai-key a new person's first sign-in gets the site key and skips the AI step", async ({
  page,
  browser,
}) => {
  await storeKey(page);
  await page.request.get("/fixture/scenario?value=pi-onboarding");
  await page.request.get("/fixture/pi-state?value=missing");
  const bob = await newPerson(browser);
  // Usable native credentials end onboarding: Bob lands in his workspaces.
  await expect(
    bob.getByRole("heading").and(bob.getByTestId("workspaces-title")),
  ).toBeVisible();
  await expect(bob.getByTestId("pi-sign-in-title")).toHaveCount(0);
  // The copy is Bob's own native credential, read by his daemon.
  const own = await (await bob.request.get("/api/v1/pi/credentials")).json();
  expect(own).toMatchObject({ anthropic: { present: true, suffix: "Xa1b" } });
  await bob.context().close();
  await page.request.get("/fixture/scenario?value=ready");
  await page.request.get("/fixture/pi-state?value=usable");
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
