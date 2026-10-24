import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});

// The synthetic broker: Alice (42) is site.json's administrator, Bob (43) a
// runtime entry who has joined, Carol (44) a GitHub account with no
// admission. /fixture/access delays broker writes so the wait shows.

async function signIn(page: Page, who: 0 | 1) {
  await page.goto("/settings");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(who).click();
  await expect(page).not.toHaveURL(/fixture\/provider/);
}

test("@server-access an administrator adds, removes and restores a person; removal ends their session", async ({
  page,
  browser,
}) => {
  const bobContext = await browser.newContext({
    baseURL: hostOrigin,
    ignoreHTTPSErrors: true,
  });
  const bob = await bobContext.newPage();
  await signIn(bob, 1);
  expect((await bob.request.get("/api/v1/server")).status()).toBe(200);

  await signIn(page, 0);
  await page.goto("/settings/users");
  const row = (id: string) => page.getByTestId(`access-row-${id}`);
  await expect(row("43")).toHaveAttribute("data-state", "joined");
  // Root's administrator has no remove action and no role control here.
  await expect(row("42").getByRole("button")).toHaveCount(0);
  // The broker keeps no login for root's entry; the gateway names it from
  // GitHub, so the label is the login and not the numeric id.
  await expect(page.getByTestId("access-login-42")).toContainText("alice");
  await expect(page.getByTestId("access-login-42")).not.toHaveAttribute(
    "data-unnamed",
  );
  await expect(page.getByTestId("account-role-toggle")).toHaveCount(0);

  expect((await page.request.get("/fixture/access?delay=600")).status()).toBe(
    204,
  );

  // Add Carol: GitHub check by login, then the broker by numeric id.
  await page.getByTestId("access-login-input").fill("@Carol");
  await page.getByRole("button").and(page.getByTestId("access-add")).click();
  await expect(page.getByTestId("access-check")).toHaveAttribute(
    "data-kind",
    "found",
  );
  await page.getByRole("button").and(page.getByTestId("access-add")).click();
  await expect(row("44")).toHaveAttribute("data-pending", "add");
  await expect(row("44")).not.toHaveAttribute("data-pending", /./);
  await expect(row("44")).toHaveAttribute("data-state", "allowed");

  // A duplicate is reported under the field.
  await page.getByTestId("access-login-input").fill("bob");
  await page.getByRole("button").and(page.getByTestId("access-add")).click();
  await expect(page.getByTestId("access-check")).toHaveAttribute(
    "data-kind",
    "duplicate",
  );

  // Remove Bob: the row waits, then stays as withdrawn, and his browser
  // session is gone.
  await page
    .getByRole("button")
    .and(page.getByTestId("access-remove-43"))
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button")
    .and(page.getByTestId("access-remove-confirm"))
    .click();
  await expect(row("43")).toHaveAttribute("data-pending", "remove");
  await expect(row("43")).toHaveAttribute("data-state", "withdrawn");
  await expect(row("43")).not.toHaveAttribute("data-pending", /./);
  expect((await bob.request.get("/api/v1/server")).status()).toBe(401);

  // Restore Bob: he signs in to the same account again.
  await page
    .getByRole("button")
    .and(page.getByTestId("access-restore-43"))
    .click();
  await expect(row("43")).toHaveAttribute("data-pending", "restore");
  await expect(row("43")).toHaveAttribute("data-state", "joined");
  await signIn(bob, 1);
  expect((await bob.request.get("/api/v1/server")).status()).toBe(200);

  // The list after a reload agrees with what the replies showed.
  await page.reload();
  await expect(row("43")).toHaveAttribute("data-state", "joined");
  await expect(row("44")).toHaveAttribute("data-state", "allowed");
  await bobContext.close();
});

test("@server-access @a11y a lost broker reply leaves the row uncertain until refreshed; open mode locks the list", async ({
  page,
}) => {
  await signIn(page, 0);
  await page.goto("/settings/users");
  const row = page.getByTestId("access-row-43");
  await expect(row).toHaveAttribute("data-state", "joined");
  expect(
    (
      await new AxeBuilder({ page })
        .include("[data-testid=server-access]")
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(row).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
  await page.setViewportSize({ width: 1280, height: 900 });
  expect((await page.request.get("/fixture/access?lose=1")).status()).toBe(204);
  await page
    .getByRole("button")
    .and(page.getByTestId("access-remove-43"))
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button")
    .and(page.getByTestId("access-remove-confirm"))
    .click();
  await expect(row).toHaveAttribute("data-pending", "uncertain");
  await page
    .getByRole("button")
    .and(page.getByTestId("access-refresh-43"))
    .click();
  // The broker committed it; the reply was only lost.
  await expect(row).toHaveAttribute("data-state", "withdrawn");
  await expect(row).not.toHaveAttribute("data-pending", /./);

  expect((await page.request.get("/fixture/access?mode=any")).status()).toBe(
    204,
  );
  await page.reload();
  await expect(page.getByTestId("access-open")).toBeVisible();
  await expect(page.getByTestId("access-login-input")).toHaveCount(0);
  await expect(page.getByTestId("access-restore-43")).toBeDisabled();
});
