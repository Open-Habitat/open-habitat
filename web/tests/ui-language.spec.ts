import AxeBuilder from "@axe-core/playwright";
import type { Browser } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

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

const freshContext = (browser: Browser, locale: string) =>
  browser.newContext({
    baseURL: hostOrigin,
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 900 },
    locale,
  });
const choice = (page: Page, group: string, id: string) =>
  page.getByTestId(group).getByTestId(`segment-${id}`);

for (const language of ["en-US", "en-GB"]) {
  test(`@ui-language ${language} switches immediately, persists and follows the person`, async ({
    page,
    browser,
  }) => {
    await signIn(page);
    await page.goto("/settings/appearance");
    await expect(choice(page, "language-choice", "system")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const write = page.waitForRequest(
      (r) =>
        r.url().endsWith("/api/v1/account/preferences") && r.method() === "PUT",
    );
    await choice(page, "language-choice", language).click();
    expect((await write).postDataJSON()).toEqual({ language });
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await choice(page, "language-choice", "system").hover();
    expect(
      (
        await new AxeBuilder({ page })
          .include('[data-settings-row="language"]')
          .analyze()
      ).violations,
    ).toEqual([]);
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await page.reload();
    await expect(choice(page, "language-choice", language)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    const other = await freshContext(browser, "fi-FI");
    try {
      const second = await other.newPage();
      await signIn(second);
      await expect(second.locator("html")).toHaveAttribute("lang", language);
      await second.goto("/settings/appearance");
      await expect(choice(second, "language-choice", language)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await choice(second, "language-choice", "system").click();
      await expect(second.locator("html")).toHaveAttribute("lang", "fi");
    } finally {
      await other.close();
    }
  });

  test(`@ui-language administrator default ${language} reaches sign-in and people without a choice`, async ({
    page,
    browser,
  }) => {
    await signIn(page);
    await page.goto("/settings/server");
    const write = page.waitForRequest(
      (r) =>
        r.url().endsWith("/api/v1/server/administration") &&
        r.method() === "PUT",
    );
    await choice(page, "server-language-choice", language).click();
    expect((await write).postDataJSON()).toEqual({
      default_language: language,
    });
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    await choice(page, "server-language-choice", "system").hover();
    expect(
      (
        await new AxeBuilder({ page })
          .include('[data-settings-row="server-language"]')
          .analyze()
      ).violations,
    ).toEqual([]);
    await expect(
      choice(page, "server-language-choice", language),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("lang", language);
    const other = await freshContext(browser, "fi-FI");
    try {
      const bob = await other.newPage();
      await bob.goto("/workspaces");
      await expect(bob.getByTestId("github-sign-in")).toBeVisible();
      await expect(bob.locator("html")).toHaveAttribute("lang", language);
      await bob.getByTestId("github-sign-in").click();
      await bob.getByRole("link", { name: "Bob", exact: true }).click();
      await bob.goto("/settings/appearance");
      await expect(bob.locator("html")).toHaveAttribute("lang", language);
      await choice(bob, "language-choice", "fi").click();
      await expect(bob.locator("html")).toHaveAttribute("lang", "fi");
    } finally {
      await other.close();
    }
  });
}

for (const [locale, language] of [
  ["en-GB", "en-GB"],
  ["en-US", "en-US"],
  ["en-AU", "en-US"],
  ["sv-SE", "en-US"],
  ["fi-FI", "fi"],
]) {
  test(`@ui-language System resolves browser ${locale} before and after sign-in`, async ({
    browser,
  }) => {
    const context = await freshContext(browser, locale);
    try {
      const page = await context.newPage();
      await page.goto("/workspaces");
      await expect(page.getByTestId("github-sign-in")).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await signIn(page);
      await page.goto("/settings/appearance");
      await expect(choice(page, "language-choice", "system")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await expect(page.locator("html")).toHaveAttribute("lang", language);
    } finally {
      await context.close();
    }
  });
}
