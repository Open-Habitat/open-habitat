import { hostOrigin } from "../test-ports.mjs";
import { confirmGitIdentity } from "./git-identity-helper";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

test("@workspace-slice home labels history honestly and route focus keeps keyboard ring", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("login-submit").click();
  await page.locator('a[href*="code=42"]').click();
  await page.goto("/workspaces");
  const heading = page.getByTestId("home-heading");
  await expect(heading).toBeFocused();
  await expect(page.getByTestId("home-heading")).toBeVisible();
  const links = page.locator(".ah-home-card-head a");
  await expect(links.first()).toBeVisible();
  for (const link of await links.all()) {
    if ((await link.getAttribute("href"))?.startsWith("/agents/"))
      await expect(
        link
          .locator("..")
          .locator('[data-testid="status-mark"][data-kind="read-only"]'),
      ).toBeVisible();
  }
  // Mouse navigation moves screen-reader focus, but does not draw the UA's black frame.
  await expect
    .poll(() => heading.evaluate((el) => getComputedStyle(el).outlineStyle))
    .toBe("none");
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toBeVisible();
  expect(
    await focused.evaluate((el) => getComputedStyle(el).outlineStyle),
  ).toBe("solid");
  expect(
    await focused.evaluate((el) => getComputedStyle(el).outlineWidth),
  ).toBe("2px");
  await page.setViewportSize({ width: 390, height: 844 });
  // Stress the real list CSS with a synthetic long title; the host fixture's
  // short title cannot expose clipping.
  const longTitle = links.first();
  await longTitle.evaluate((el) => {
    el.textContent = `Pitkä keskustelun otsikko ${"sisältö ".repeat(24)}`;
  });
  expect(
    await longTitle.evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  const readOnly = page
    .locator(".ah-home-card-head")
    .filter({
      has: page.locator('[data-testid="status-mark"][data-kind="read-only"]'),
    })
    .locator("a")
    .first();
  if (await readOnly.count()) {
    await readOnly.click();
    await expect(page).toHaveURL(/\/agents\//);
    await expect(page.getByTestId("home-heading")).toHaveCount(0);
  }
});

test("@first-use pending code keeps attempt cancellation separate from sign-out", async ({
  page,
}) => {
  try {
    await page.request.get("/fixture/scenario?value=pi-onboarding");
    await page.request.get("/fixture/pi-state?value=missing");
    await page.goto("/workspaces");
    await page.getByTestId("login-submit").click();
    await page.locator('a[href*="code=42"]').click();
    await confirmGitIdentity(page);
    await expect(page.getByTestId("repo-chooser-heading")).toBeVisible();
    await page.getByTestId("repo-proceed").click();
    await page.getByTestId("pi-signin-start").click();
    await expect(page.getByTestId("pi-signin-cancel")).toHaveClass(
      /ah-button-quiet/,
    );
    await expect(page.getByTestId("onboarding-signout")).toHaveClass(
      /ah-button-quiet/,
    );
    await page.getByTestId("pi-signin-cancel").click();
  } finally {
    await page.request.get("/fixture/pi-state?value=missing");
    await page.request.get("/fixture/scenario?value=ready");
  }
});
