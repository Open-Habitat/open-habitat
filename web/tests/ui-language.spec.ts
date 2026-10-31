import type { Browser } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// The interface language (ui-language-choice): the person's choice follows
// them through their daemon, System falls back to the server default and
// then the browser, and an administrator sets the server default.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});

async function signIn(page: Page, who: "Alice" | "Bob" = "Alice") {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link", { name: who, exact: true }).click();
  await expect(page.getByTestId("account-menu-trigger")).toBeAttached();
}

async function freshContext(browser: Browser, locale: string) {
  return browser.newContext({
    baseURL: hostOrigin,
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 900 },
    locale,
  });
}

const choice = (page: Page, group: string, id: string) =>
  page.getByTestId(group).getByTestId(`segment-${id}`);

test("@ui-language a chosen language switches at once, survives a reload and follows the person to another browser", async ({
  page,
  browser,
}) => {
  await signIn(page);
  await page.goto("/settings/appearance");
  await expect(page.getByTestId("settings-title")).toHaveText("Asetukset");
  await expect(choice(page, "language-choice", "system")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const write = page.waitForRequest(
    (r) =>
      r.url().endsWith("/api/v1/account/preferences") && r.method() === "PUT",
  );
  await choice(page, "language-choice", "en").click();
  expect((await write).postDataJSON()).toEqual({ language: "en" });
  await expect(page.getByTestId("settings-title")).toHaveText("Settings");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByTestId("settings-section-ulkoasu")).toHaveText(
    "Appearance",
  );

  await page.reload();
  await expect(page.getByTestId("settings-title")).toHaveText("Settings");
  await expect(choice(page, "language-choice", "en")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Another browser, still a Finnish one, signs in as the same person.
  const other = await freshContext(browser, "fi-FI");
  try {
    const second = await other.newPage();
    await signIn(second);
    await expect(second.locator("html")).toHaveAttribute("lang", "en");
    await second.goto("/settings/appearance");
    await expect(second.getByTestId("settings-title")).toHaveText("Settings");
    await expect(choice(second, "language-choice", "en")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Back to System: the Finnish browser's language applies again.
    await choice(second, "language-choice", "system").click();
    await expect(second.getByTestId("settings-title")).toHaveText("Asetukset");
    await expect(second.locator("html")).toHaveAttribute("lang", "fi");
  } finally {
    await other.close();
  }
});

test("@ui-language System gives English to a browser in neither Finnish nor English", async ({
  browser,
}) => {
  const swedish = await freshContext(browser, "sv-SE");
  const finnish = await freshContext(browser, "fi-FI");
  try {
    const page = await swedish.newPage();
    await page.goto("/workspaces");
    await expect(page.getByTestId("login-heading")).toHaveText(
      "Welcome to Open Habitat",
    );
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.getByTestId("github-sign-in").click();
    await page.getByRole("link", { name: "Alice", exact: true }).click();
    await page.goto("/settings/appearance");
    await expect(page.getByTestId("settings-title")).toHaveText("Settings");
    await expect(choice(page, "language-choice", "system")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const fi = await finnish.newPage();
    await fi.goto("/workspaces");
    await expect(fi.getByTestId("login-heading")).toHaveText(
      "Tervetuloa Open Habitatiin",
    );
    await expect(fi.locator("html")).toHaveAttribute("lang", "fi");
  } finally {
    await swedish.close();
    await finnish.close();
  }
});

test("@ui-language the administrator's server default reaches sign-in and people who have not chosen", async ({
  page,
  browser,
}) => {
  await signIn(page);
  await page.goto("/settings/server");
  await expect(
    choice(page, "server-language-choice", "system"),
  ).toHaveAttribute("aria-pressed", "true");
  const write = page.waitForRequest(
    (r) =>
      r.url().endsWith("/api/v1/server/administration") && r.method() === "PUT",
  );
  await choice(page, "server-language-choice", "en").click();
  expect((await write).postDataJSON()).toEqual({ default_language: "en" });
  await expect(choice(page, "server-language-choice", "en")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // Alice has not chosen her own, so the new default applies to her too.
  await expect(page.getByTestId("settings-title")).toHaveText("Settings");

  const other = await freshContext(browser, "fi-FI");
  try {
    const bob = await other.newPage();
    await bob.goto("/workspaces");
    await expect(bob.getByTestId("login-heading")).toHaveText(
      "Welcome to Open Habitat",
    );
    await bob.getByTestId("github-sign-in").click();
    await bob.getByRole("link", { name: "Bob", exact: true }).click();
    await bob.goto("/settings/appearance");
    await expect(bob.getByTestId("settings-title")).toHaveText("Settings");
    // Bob's own choice still wins over the server default.
    await choice(bob, "language-choice", "fi").click();
    await expect(bob.getByTestId("settings-title")).toHaveText("Asetukset");
  } finally {
    await other.close();
  }
});
