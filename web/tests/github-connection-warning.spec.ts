import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// The person's own GitHub connection in the common warning
// (proto-github-connection-warning round 2, direction 2): above the composer
// in a conversation, the app-wide strip elsewhere, and the repair that
// returns to the same conversation. The synthetic host reports "unknown";
// these cases rewrite the snapshot's native_github, the one fact the
// browser reads. Same-UID synthetic evidence, not UID isolation.

test.use({
  trace: "off",
  screenshot: "off",
  video: "off",
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
});
test.beforeEach(async ({ page }) => {
  expect((await page.request.get("/fixture/reset-clock")).status()).toBe(204);
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
});

// The snapshot is rewritten in flight; a read still on its way when a case
// ends must not fail it.
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

async function nativeGitHub(page: Page, state: string, login?: string) {
  await page.unroute("**/api/v1/snapshot");
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (!body.auth) {
      await route.fulfill({ response });
      return;
    }
    body.auth.native_github = login ? { state, login } : { state };
    await route.fulfill({ response, json: body });
  });
}
async function signIn(page: Page) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeVisible();
}
/** The warning above the composer lines up with the composer's field. */
async function alignedWithComposer(page: Page) {
  const [warning, field] = await page.evaluate(() =>
    [
      ".ah-actionable-notices > .ah-warning",
      ".ah-conversation-frame > .ah-composer .ah-cbox",
    ].map((selector) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return box ? [Math.round(box.left), Math.round(box.right)] : [];
    }),
  );
  expect(warning).toEqual(field);
}
async function evidence(page: Page, name: string, selector: string) {
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const results = await new AxeBuilder({ page })
      .include(selector)
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(results.violations).toEqual([]);
    await page.screenshot({
      path: `test-results/evidence/github-connection-${name}-${theme}.png`,
    });
  }
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
}

test("@github-connection an expired login is said above the composer and app-wide, and the repair returns to the conversation", async ({
  page,
}) => {
  await nativeGitHub(page, "expired");
  await signIn(page);
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  const workspacePath = new URL(page.url()).pathname;
  // Without a conversation open, the strip under the top bar says it.
  const strip = page.locator(".ah-warning-page");
  await expect(strip).toHaveAttribute(
    "data-testid",
    "github-connection-warning",
  );
  await expect(strip).toHaveAttribute("data-state", "expired");
  await expect(strip).toHaveAttribute("role", "alert");
  await evidence(page, "workspace", ".ah-warning-page");

  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await page.getByTestId("message-input").fill("Pushaa haara");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  const conversation = new URL(page.url()).searchParams.get("conversation");
  // In the conversation the same warning is above the composer, once.
  const notice = page
    .locator(".ah-actionable-notices")
    .getByTestId("github-connection-warning");
  await expect(notice).toHaveAttribute("data-state", "expired");
  await expect(page.getByTestId("github-connection-warning")).toHaveCount(1);
  await alignedWithComposer(page);
  await evidence(page, "conversation", ".ah-actionable-notices");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(notice).toBeVisible();
  // The composer stays on screen under the warning.
  await expect(page.getByTestId("message-input")).toBeInViewport();
  await alignedWithComposer(page);
  await evidence(page, "conversation-phone", ".ah-actionable-notices");
  await page.setViewportSize({ width: 1280, height: 800 });

  // The repair is the gateway's explicit reconnect, back to this page.
  await page.route("**/auth/github/start?*", (route) => route.abort());
  const started = page.waitForRequest(/\/auth\/github\/start\?/);
  await notice.getByTestId("github-connection-fix").click();
  const url = new URL((await started).url());
  expect(url.searchParams.get("return_to")).toBe(workspacePath);
  expect(url.searchParams.get("reconnect")).toBe("1");

  // GitHub sends the person back to the path; the connection works again.
  await nativeGitHub(page, "connected", "alice-gh");
  await page.goto(workspacePath);
  await expect
    .poll(() => new URL(page.url()).searchParams.get("conversation"))
    .toBe(conversation);
  const ok = page
    .locator(".ah-actionable-notices")
    .getByTestId("github-connection-ok");
  await expect(ok).toHaveAttribute("data-state", "reconnected");
  await expect(ok).toContainText("alice-gh");
  await expect(page.getByTestId("github-connection-warning")).toHaveCount(0);
  await evidence(page, "reconnected", ".ah-actionable-notices");
});

test("@github-connection Uusi työtila says why the list is missing, without a second strip", async ({
  page,
}) => {
  await nativeGitHub(page, "disconnected");
  await page.route("**/api/v1/onboarding/github/repos", (route) =>
    route.fulfill({
      status: 409,
      json: {
        schema_version: 1,
        error: {
          code: "github_auth_unavailable",
          message: "Request could not be completed",
          retryable: false,
          correlation_id: "req_00000000",
        },
      },
    }),
  );
  await signIn(page);
  // Elsewhere the strip is there…
  await expect(page.locator(".ah-warning-page")).toHaveAttribute(
    "data-state",
    "disconnected",
  );
  await page.goto("/workspaces/new");
  // …and on the page that needs GitHub the finder says it instead.
  const place = page.getByTestId("github-place-warning");
  await expect(place).toHaveAttribute("data-state", "disconnected");
  await expect(place.getByTestId("github-place-fix")).toBeVisible();
  await expect(page.locator(".ah-warning-page")).toHaveCount(0);
  await evidence(page, "new-workspace", "[data-testid=github-place-warning]");

  // The gateway returns only to known paths; the page comes back anyway.
  await page.route("**/auth/github/start?*", (route) => route.abort());
  const started = page.waitForRequest(/\/auth\/github\/start\?/);
  await place.getByTestId("github-place-fix").click();
  const returnTo = new URL((await started).url()).searchParams.get("return_to");
  expect(returnTo).toBe("/workspaces");
  await page.goto(returnTo as string);
  await expect(page).toHaveURL(/\/workspaces\/new$/);
});

test("@github-connection a default repository typed by name is added unchecked while GitHub cannot be asked", async ({
  page,
}) => {
  await nativeGitHub(page, "expired");
  const refused = {
    status: 409,
    json: {
      schema_version: 1,
      error: {
        code: "github_auth_unavailable",
        message: "Request could not be completed",
        retryable: false,
        correlation_id: "req_00000000",
      },
    },
  };
  await page.route("**/api/v1/onboarding/github/repos", (route) =>
    route.fulfill(refused),
  );
  await page.route("**/api/v1/onboarding/github/repository?*", (route) =>
    route.fulfill(refused),
  );
  await signIn(page);
  await page.goto("/settings/onboarding");
  await page
    .getByRole("button")
    .and(page.getByTestId("onboarding-add-repository"))
    .click();
  const finder = page
    .getByRole("dialog")
    .and(page.getByTestId("onboarding-repository-finder"));
  await expect(finder.getByTestId("github-place-warning")).toHaveAttribute(
    "data-state",
    "expired",
  );
  await finder.getByTestId("repository-search").fill("example-org/handbook");
  const row = finder
    .getByRole("link")
    .and(finder.getByTestId("repository-unchecked-example-org/handbook"));
  await expect(row).toBeVisible();
  await evidence(page, "default-repository", "[role=dialog]");
  await row.click();
  // The gateway saves the name as typed; access is each newcomer's own.
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/v1/server/onboarding")).json())
          .repositories.defaults,
    )
    .toEqual(["example-org/handbook"]);
  await expect(row).toHaveAttribute("aria-current", "page");
});
