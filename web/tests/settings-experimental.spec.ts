import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Asetukset › Kokeelliset ominaisuudet (experimental-features-section,
// Esittely): a card per feature, off by default, switched account-wide by the
// person's daemon and shown only once it has confirmed.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
  // Jari reviews the screenshots; 1x evidence was blurry.
  deviceScaleFactor: 2,
});

const evidence = "../issues/experimental-features-section/evidence";
const capture = !!process.env.OH_VISUAL_CAPTURE;
const features = [
  "rewind-conversation",
  "explain-mode",
  "agent-resources-view",
  "shares-page",
  "conversation-context-view",
  "named-workers",
  "remote-browser",
  "atlassian-connect",
  "trello-connect",
  "turn-changes",
  "terminal-copy-on-select",
  "terminal-open-urls",
  "storage-breakdown",
];

async function signIn(page: Page) {
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeAttached();
}

const card = (page: Page, id: string) =>
  page.getByRole("region").and(page.getByTestId(`experimental-${id}`));
const segment = (page: Page, id: string, value: "on" | "off") =>
  card(page, id)
    .getByRole("group")
    .and(page.getByTestId(`experimental-${id}-choice`))
    .getByRole("button")
    .and(page.getByTestId(`segment-${value}`));

test("@settings-experimental a feature is off by default, switches on the daemon's confirmation and stays on for the account", async ({
  page,
  context,
}) => {
  await signIn(page);
  await page.goto("/settings/experimental");
  await expect(
    page.getByRole("heading", { name: "Kokeelliset ominaisuudet" }),
  ).toBeVisible();
  for (const id of features) {
    await expect(card(page, id)).toBeVisible();
    await expect(segment(page, id, "off")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(card(page, id).getByText("Missä")).toBeVisible();
    await expect(card(page, id).getByText("Edellyttää")).toBeVisible();
  }
  await expect(
    page.getByTestId("experimental-features").getByRole("region"),
  ).toHaveCount(features.length);
  const a11y = await new AxeBuilder({ page })
    .include('[data-testid="experimental-features"]')
    // The pictures are aria-hidden decoration, faded on purpose while off;
    // the facts beside them carry the same in text.
    .exclude(".ex-pic")
    .analyze();
  expect(a11y.violations).toEqual([]);
  if (capture)
    await page.screenshot({
      path: `${evidence}/kokeelliset-desktop-light-pois.png`,
      fullPage: true,
    });

  const write = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/v1/account/preferences") &&
      request.method() === "PUT",
  );
  await segment(page, "explain-mode", "on").click();
  expect((await write).postDataJSON()).toEqual({
    experimental: { "explain-mode": true },
  });
  await expect(segment(page, "explain-mode", "on")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(segment(page, "rewind-conversation", "off")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Another tab of the same account reads it from the daemon, not the browser.
  const other = await context.newPage();
  try {
    await other.goto("/settings/experimental");
    await expect(segment(other, "explain-mode", "on")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    if (capture) {
      await other.emulateMedia({ colorScheme: "dark" });
      await other.evaluate(() => {
        localStorage.setItem("nah:theme", "dark");
        window.dispatchEvent(new Event("nah:theme-change"));
      });
      await other.setViewportSize({ width: 390, height: 844 });
      await card(other, "explain-mode").scrollIntoViewIfNeeded();
      await other.screenshot({
        path: `${evidence}/kokeelliset-phone-dark-paalla.png`,
      });
      await other.evaluate(() => localStorage.removeItem("nah:theme"));
    }
  } finally {
    await other.close();
  }

  await segment(page, "explain-mode", "off").click();
  await expect(segment(page, "explain-mode", "off")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("@settings-experimental a failed save keeps the feature off and offers to read the saved choice", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings/experimental");
  await expect(segment(page, "rewind-conversation", "off")).toBeEnabled();
  await page.route("**/api/v1/account/preferences", async (route) => {
    if (route.request().method() === "PUT")
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          schema_version: 1,
          error: { code: "preferences_unavailable" },
        }),
      });
    else await route.fallback();
  });
  await segment(page, "rewind-conversation", "on").click();
  const alert = page
    .getByRole("alert")
    .and(page.getByTestId("experimental-rewind-conversation-error"));
  await expect(alert).toBeVisible();
  await expect(segment(page, "rewind-conversation", "off")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  if (capture)
    await page.screenshot({
      path: `${evidence}/kokeelliset-desktop-light-tallennus-epaonnistui.png`,
    });
  await page.unroute("**/api/v1/account/preferences");
  await page
    .getByRole("button")
    .and(page.getByTestId("experimental-rewind-conversation-error-reload"))
    .click();
  await expect(alert).toBeHidden();
});

test("@settings-experimental settings search finds a feature and lands on its card", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings");
  await page
    .getByRole("combobox")
    .and(page.getByTestId("settings-search"))
    .fill("rewind");
  await page
    .getByRole("option")
    .and(page.getByTestId("settings-result-row-rewind-conversation"))
    .click();
  await expect(page).toHaveURL(/\/settings\/experimental#rewind-conversation$/);
  await expect(card(page, "rewind-conversation")).toBeInViewport();
});
