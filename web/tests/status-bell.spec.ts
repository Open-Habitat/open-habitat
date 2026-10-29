import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// The status bell (proto-notification-bell, direction Tila): present only
// while an account- or server-wide condition holds, one bell per screen in
// the page's own head, no strips above the shell. Every fact is rewritten in
// flight: the own storage read, the snapshot's native_github, the role and
// the server's storage read. Same-UID synthetic evidence, not UID isolation.

test.use({
  trace: "off",
  screenshot: "off",
  video: "off",
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
});
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

const GiB = 1024 ** 3;

async function conditions(page: Page, overcommitted: { value: boolean }) {
  await page.route("**/api/v1/account/storage", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        usage_bytes: Math.round(9.2 * GiB),
        limit_bytes: 10 * GiB,
      },
    }),
  );
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (body.auth) body.auth.native_github = { state: "expired" };
    await route.fulfill({ response, json: body });
  });
  await page.route("**/api/v1/server", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...(await response.json()), administrator: true },
    });
  });
  await page.route("**/api/v1/server/storage", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        limits: "enforced",
        users: [
          {
            id: "u1",
            username: "alice",
            administrator: true,
            unavailable: false,
            usage_bytes: Math.round(9.2 * GiB),
            limit_bytes: 80 * GiB,
          },
          {
            id: "u2",
            username: "bob",
            administrator: false,
            unavailable: false,
            usage_bytes: GiB,
            limit_bytes: 80 * GiB,
          },
        ],
        filesystem: { capacity_bytes: 120 * GiB, free_bytes: 60 * GiB },
        overcommitted: overcommitted.value,
      },
    }),
  );
}

const bell = (page: Page) =>
  page.locator('[data-testid="status-bell"]:visible');

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

async function evidence(page: Page, name: string) {
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const results = await new AxeBuilder({ page })
      .include("[data-testid=status-panel]")
      .include("[data-testid=status-bell]")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(results.violations).toEqual([]);
    await page.screenshot({
      path: `test-results/evidence/status-bell-${name}-${theme}.png`,
    });
  }
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
}

/** The panel lies inside the screen, and Esc returns focus to the bell. */
async function openAndClose(page: Page, name: string) {
  await bell(page).click();
  const panel = page.getByTestId("status-panel");
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect(box && box.x >= 0 && box.x + box.width <= width).toBe(true);
  await noOverflow(page);
  await evidence(page, name);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(bell(page)).toBeFocused();
}

test("@status-bell several conditions behind one bell on desktop and phone, the server's only for an administrator", async ({
  page,
}) => {
  const overcommitted = { value: true };
  await conditions(page, overcommitted);
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.locator('a[href*="code=42"]').click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();

  // Desktop without a top bar: the bell is in the rail head, the expired
  // GitHub connection on it in words, and no strip above the shell.
  await expect(bell(page)).toHaveCount(1);
  await expect(
    page.locator('.ah-rail [data-testid="status-bell"]'),
  ).toBeVisible();
  await expect(bell(page)).toHaveAttribute("data-tone", "danger");
  await expect(bell(page)).toHaveAttribute("data-count", "3");
  await expect(
    page.locator(".ah-warning-page, [data-testid=quota-state]"),
  ).toHaveCount(0);
  await bell(page).click();
  const items = page.getByTestId("status-panel").getByTestId("status-item");
  // Most serious first; the server's condition in its own group.
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toHaveAttribute("data-key", "github");
  await expect(
    page.locator('[data-testid="status-item"][data-key="server-storage"]'),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await openAndClose(page, "workspace");

  // In a conversation the bell moves into its top bar; one bell still.
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page.getByTestId("message-input")).toBeVisible();
  await expect(
    page.locator('.ah-agent-header [data-testid="status-bell"]'),
  ).toBeVisible();
  await expect(bell(page)).toHaveCount(1);
  await openAndClose(page, "conversation");

  // The phone: the conversation's top bar, then the toolbar elsewhere.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(bell(page)).toHaveCount(1);
  await expect(page.getByTestId("message-input")).toBeInViewport();
  await openAndClose(page, "conversation-phone");
  await page.goto("/workspaces");
  await expect(
    page.locator('.ah-mobile-toolbar [data-testid="status-bell"]'),
  ).toBeVisible();
  await expect(bell(page)).toHaveCount(1);
  await openAndClose(page, "home-phone");
  await page.goto("/settings/storage");
  await expect(bell(page)).toHaveCount(1);

  // The limits are brought under the disk: that item leaves by itself.
  overcommitted.value = false;
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.reload();
  await expect(bell(page)).toHaveAttribute("data-count", "2");
});

test("@status-bell nothing holds, no bell; a person who is not an administrator never reads the server's storage", async ({
  page,
}) => {
  let serverReads = 0;
  await page.route("**/api/v1/server/storage", (route) => {
    serverReads++;
    return route.fulfill({ status: 403 });
  });
  await page.route("**/api/v1/server", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...(await response.json()), administrator: false },
    });
  });
  await page.route("**/api/v1/account/storage", (route) =>
    route.fulfill({
      json: { schema_version: 1, usage_bytes: GiB, limit_bytes: 10 * GiB },
    }),
  );
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  const storageRead = page.waitForResponse("**/api/v1/account/storage");
  await page.locator('a[href*="code=42"]').click();
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeVisible();
  await storageRead;
  await expect(page.locator("[data-testid=status-bell]")).toHaveCount(0);
  expect(serverReads).toBe(0);
});

test("@status-bell single-workspace mode carries the bell in its top bar, on a phone too", async ({
  page,
}) => {
  await conditions(page, { value: false });
  await page.request.get("/fixture/scenario?value=ready");
  expect(
    (
      await page.request.get("/fixture/keep-workspaces?names=ordinary-dir")
    ).status(),
  ).toBe(204);
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.locator('a[href*="code=42"]').click();
  await expect(
    page.locator('.ah-single-bar [data-testid="status-bell"]'),
  ).toBeVisible();
  await expect(bell(page)).toHaveCount(1);
  await openAndClose(page, "single");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(bell(page)).toHaveCount(1);
  await openAndClose(page, "single-phone");
});
