import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Single-workspace mode (Yläpalkissa, Jari 18.10.2026) follows the number of
// visible native workspaces in each snapshot: with one there is no sidebar,
// the top bar carries the workspace, and its Trash action is blocked with the
// reason. The real daemon moves a workspace to the Trash and back, so the
// frame changes both ways from the host's own state.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
});

async function signIn(page: Page, keep: string[]) {
  await page.request.get("/fixture/scenario?value=ready");
  expect(
    (await page.request.get(`/fixture/keep-workspaces?names=${keep}`)).status(),
  ).toBe(204);
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
}
const rail = (page: Page) => page.getByRole("navigation");
const bar = (page: Page) => page.locator(".ah-single-bar");
const notice = (page: Page) => page.locator(".ah-archive-notice");
async function serious(page: Page) {
  const result = await new AxeBuilder({ page })
    .exclude("[data-live-announcer]")
    .analyze();
  expect(
    result.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
}

test("@single-workspace one workspace has a top bar, its own home and a blocked Trash", async ({
  page,
}) => {
  await signIn(page, ["ordinary-dir"]);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(rail(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  const home = bar(page)
    .getByRole("link")
    .and(page.getByTestId("workspace-ordinary-dir"));
  await expect(home).toHaveAttribute("aria-current", "page");
  const create = bar(page)
    .getByRole("button")
    .and(page.getByTestId("single-new-conversation"));
  await expect(create).toBeEnabled();
  // Audit the ready control, not an intermediate disabled→primary color.
  await create.evaluate(async (node) => {
    await Promise.all(
      node.getAnimations().map((animation) => animation.finished),
    );
  });
  await serious(page);

  // The workspace's own actions, with the last one's Trash blocked and why.
  await bar(page)
    .getByRole("button")
    .and(page.getByTestId("workspace-menu"))
    .click();
  const trash = page.getByRole("menuitem").and(page.getByTestId("menu-trash"));
  await expect(trash).toBeDisabled();
  await expect(trash).toBeVisible();
  await expect(
    page.getByRole("menuitem").and(page.getByTestId("menu-add")),
  ).toBeEnabled();
  // A plain directory has no worktree agents.
  await expect(
    page.getByRole("menuitem").and(page.getByTestId("menu-worktree")),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");

  // The server and its connection moved into the account menu.
  await bar(page)
    .getByRole("button")
    .and(page.getByTestId("account-menu-trigger"))
    .click();
  await expect(page.locator(".ah-account-server")).toBeVisible();
  await page.keyboard.press("Escape");

  // The workspace page is the home page, and a conversation does not repeat
  // the workspace's name below the bar.
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  const id = snapshot.workspaces[0].workspace_id;
  await page.goto(`/workspaces/${id}`);
  await expect(page).toHaveURL(/\/$/);
  await page.locator(".ah-home-card a").first().click();
  await expect(page.locator(".ah-agent-header h1")).toBeVisible();
  await expect(page.locator(".ah-header-workspace")).toBeHidden();
  await expect(home).not.toHaveAttribute("aria-current", "page");
  const deepLink = page.url();
  await page.reload();
  await expect(page.locator(".ah-agent-header h1")).toBeVisible();
  await expect(page).toHaveURL(deepLink);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.goForward();
  await expect(page).toHaveURL(deepLink);
  await home.click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // On the phone the bar replaces the navigation drawer.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(bar(page)).toBeVisible();
  await expect(
    page.getByRole("button").and(page.getByTestId("navigation-open")),
  ).toHaveCount(0);
  await expect(
    bar(page)
      .getByRole("button")
      .and(page.getByTestId("single-new-conversation")),
  ).toBeVisible();
  const box = await bar(page).boundingBox();
  expect(box?.width).toBeLessThanOrEqual(390);
  await serious(page);
});

test("@single-workspace the frame follows the count both ways, with a notice", async ({
  page,
}) => {
  await signIn(page, ["ordinary-dir", "without-metadata"]);
  await expect(rail(page)).toBeVisible();
  await expect(bar(page)).toHaveCount(0);

  // Two to one: the second goes to the Trash and the frame becomes single.
  await rail(page)
    .getByRole("link")
    .and(page.getByTestId("workspace-without-metadata"))
    .click();
  await page
    .getByRole("button")
    .and(page.getByTestId("delete-workspace"))
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button")
    .and(page.getByTestId("trash-workspace"))
    .click();
  await expect(notice(page)).toBeVisible();
  await expect(bar(page)).toBeVisible();
  await expect(rail(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // One to two: Palauta brings it back, and the sidebar with it.
  await notice(page)
    .getByRole("button")
    .and(page.getByTestId("restore-notice"))
    .click();
  await expect(rail(page)).toBeVisible();
  await expect(bar(page)).toHaveCount(0);
  await expect(notice(page)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("@single-workspace a hidden workspace does not count and is restored from home", async ({
  page,
}) => {
  await signIn(page, ["ordinary-dir", "without-metadata"]);
  await rail(page)
    .getByRole("link")
    .and(page.getByTestId("workspace-without-metadata"))
    .click();
  await page
    .getByRole("button")
    .and(page.getByTestId(/^workspace-(archive|restore)$/))
    .click();
  await expect(bar(page)).toBeVisible();
  await expect(rail(page)).toHaveCount(0);
  await expect(
    page
      .getByRole("status")
      .filter({ has: page.getByTestId("restore-notice") }),
  ).toBeVisible();
  await bar(page)
    .getByRole("link")
    .and(page.getByTestId("workspace-ordinary-dir"))
    .click();
  const archived = page
    .getByRole("region")
    .and(page.getByTestId("archived-workspaces"));
  await archived
    .getByRole("button")
    .and(page.getByTestId("toggle-archived"))
    .click();
  await archived
    .getByRole("button")
    .and(page.getByTestId("restore-workspace-without-metadata"))
    .click();
  await expect(rail(page)).toBeVisible();
  await expect(notice(page).last()).toBeVisible();
});

test("@single-workspace a Git workspace offers a worktree agent from the menu", async ({
  page,
}) => {
  await signIn(page, ["git-project"]);
  await bar(page)
    .getByRole("button")
    .and(page.getByTestId("workspace-menu"))
    .click();
  const item = page
    .getByRole("menuitem")
    .and(page.getByTestId("menu-worktree"));
  await expect(item).toBeEnabled();
  await item.click();
  await expect(page).toHaveURL(/conversation=new-worktree$/);
});

test("@single-workspace an incomplete archive notice shares the home column", async ({
  page,
}) => {
  // Inject only the unavailable source observation; keep host identity and data.
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.sources.find(
      (f: { source: string }) => f.source === "pi_history",
    ).state = "unknown";
    await route.fulfill({ response, json: body });
  });
  await signIn(page, ["ordinary-dir"]);
  const warning = page.locator(".ah-workspace-home-notice");
  await expect(warning).toBeVisible();
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    for (const width of [1920, 1000, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const noticeBox = await warning.boundingBox();
      const contentBox = await page.locator(".ah-workspace-page").boundingBox();
      if (!noticeBox || !contentBox) throw new Error("Missing home column");
      expect(Math.abs(noticeBox.x - contentBox.x)).toBeLessThan(2);
      expect(Math.abs(noticeBox.width - contentBox.width)).toBeLessThan(2);
    }
  }
  await serious(page);
});
