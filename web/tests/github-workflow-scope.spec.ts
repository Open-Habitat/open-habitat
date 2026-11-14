import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Settings › Code hosts' GitHub workflow permission (github-workflow-scope,
// direction A Rivi). The token's scopes are routed into the snapshot, as
// the synthetic host has no GitHub to read them from; the person's opt-in
// is the synthetic daemon's own preferences, read as stored or routed.
test.use({
  trace: "off",
  screenshot: "off",
  video: "off",
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

const base = ["gist", "read:org", "repo"];

async function login(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeVisible();
}

/** A working login whose token has these scopes; null: not read. */
async function scopes(page: Page, list: string[] | null) {
  await page.unroute("**/api/v1/snapshot");
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (!body.auth) {
      await route.fulfill({ response });
      return;
    }
    body.auth.native_github = {
      ...body.auth.native_github,
      state: "connected",
      login: "alice",
      scopes: list,
    };
    await route.fulfill({ response, json: body });
  });
}

/** The person had allowed workflows: the stored opt-in, as the daemon
 * reads it. Writes still go to the daemon and its reply is the truth. */
async function remembered(page: Page) {
  await page.route("**/api/v1/account/preferences", async (route) => {
    const response = await route.fetch();
    if (route.request().method() !== "GET") {
      await route.fulfill({ response });
      return;
    }
    const body = await response.json();
    await route.fulfill({ response, json: { ...body, github_workflow: true } });
  });
}

async function evidence(page: Page, name: string) {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const results = await new AxeBuilder({ page })
        .include("[data-settings-row=github]")
        .include("[data-settings-row=github-workflow]")
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(results.violations).toEqual([]);
      await page
        .getByTestId("github-workflow")
        .evaluate((el) => el.scrollIntoView({ block: "center" }));
      await page.screenshot({
        path: `test-results/evidence/github-workflow-${name}-${width}-${theme}.png`,
      });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
}

test("@github-workflow-scope off by default; allowing and removing sign in again with and without workflow", async ({
  page,
}) => {
  await login(page);
  await scopes(page, base);
  await page.goto("/settings/code-hosts");
  const row = page.locator("#main").getByTestId("github-workflow");
  await expect(row).toHaveAttribute("data-wf", "off");
  await expect(row).toContainText("Ei sallittu");
  await expect(row).toContainText("voi lukea repon salaisuudet");
  await expect(
    page.locator("#main").getByTestId("github-scopes").locator("li"),
  ).toHaveText(base);
  await evidence(page, "off");

  // Allowing is the explicit reconnect with the workflow scope added.
  const started = page.waitForRequest(/\/auth\/github\/start\?/);
  await page
    .getByRole("button")
    .and(page.getByTestId("github-workflow-allow"))
    .click();
  const start = new URL((await started).url());
  expect(start.searchParams.get("reconnect")).toBe("1");
  expect(start.searchParams.get("scope")).toBe("workflow");
  expect(start.searchParams.get("return_to")).toBe("/settings/code-hosts");
  await expect(page).toHaveURL(/\/fixture\/provider\?/);
  await scopes(page, [...base, "workflow"]);
  await page.getByRole("link").nth(0).click();
  await expect(page).toHaveURL(/\/settings\/code-hosts$/);
  await expect(row).toHaveAttribute("data-wf", "on");
  await expect(row).toContainText("Sallittu");
  await expect(
    page.locator("#main").getByTestId("github-scopes").locator("li"),
  ).toHaveText([...base, "workflow"]);
  await evidence(page, "on");

  // The card's own Reconnect keeps the scope the token has.
  const again = page.waitForRequest(/\/auth\/github\/start\?/);
  await page
    .getByRole("button")
    .and(page.getByTestId("github-reconnect"))
    .click();
  expect(new URL((await again).url()).searchParams.get("scope")).toBe(
    "workflow",
  );
  await page.getByRole("link").nth(0).click();
  await expect(row).toHaveAttribute("data-wf", "on");

  // Removing clears the remembered wish first, then signs in again
  // without the scope.
  const cleared = page.waitForRequest(
    (r) =>
      r.url().endsWith("/api/v1/account/preferences") && r.method() === "PUT",
  );
  const removed = page.waitForRequest(/\/auth\/github\/start\?/);
  await page
    .getByRole("button")
    .and(page.getByTestId("github-workflow-remove"))
    .click();
  expect((await cleared).postData()).toBe('{"github_workflow":false}');
  const remove = new URL((await removed).url());
  expect(remove.searchParams.get("reconnect")).toBe("1");
  expect(remove.searchParams.has("scope")).toBe(false);
  await scopes(page, base);
  await page.getByRole("link").nth(0).click();
  await expect(row).toHaveAttribute("data-wf", "off");
});

test("@github-workflow-scope a remembered permission the token lacks is missing; Don't allow forgets it", async ({
  page,
}) => {
  await login(page);
  await scopes(page, base);
  await remembered(page);
  await page.goto("/settings/code-hosts");
  const row = page.locator("#main").getByTestId("github-workflow");
  await expect(row).toHaveAttribute("data-wf", "missing");
  await expect(row).toContainText("Lupa puuttuu");
  await expect(row).toContainText("gh auth refresh");
  await evidence(page, "missing");
  // Allow again asks for the scope; the card's Reconnect keeps asking too.
  const again = page.waitForRequest(/\/auth\/github\/start\?/);
  await page
    .getByRole("button")
    .and(page.getByTestId("github-reconnect"))
    .click();
  expect(new URL((await again).url()).searchParams.get("scope")).toBe(
    "workflow",
  );
  await page.getByRole("link").nth(0).click();
  await expect(row).toHaveAttribute("data-wf", "missing");
  // Don't allow is written to the daemon; its confirmation turns it off.
  const put = page.waitForRequest(
    (r) =>
      r.url().endsWith("/api/v1/account/preferences") && r.method() === "PUT",
  );
  await page
    .getByRole("button")
    .and(page.getByTestId("github-workflow-keep-off"))
    .click();
  expect((await put).postData()).toBe('{"github_workflow":false}');
  await expect(row).toHaveAttribute("data-wf", "off");
  await expect(page.getByTestId("github-workflow-said")).toContainText(
    "enää huomauteta",
  );
});

test("@github-workflow-scope unread scopes are not known", async ({ page }) => {
  await login(page);
  await scopes(page, null);
  await page.goto("/settings/code-hosts");
  const row = page.locator("#main").getByTestId("github-workflow");
  await expect(row).toHaveAttribute("data-wf", "unknown");
  await expect(row).toContainText("Ei tiedossa");
  await expect(page.locator("#main").getByTestId("github-scopes")).toHaveText(
    "Oikeuksia ei voitu lukea.",
  );
  await evidence(page, "unknown");
});
