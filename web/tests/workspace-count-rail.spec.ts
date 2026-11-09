import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Everyone has the same layout and rail, whatever the number of workspaces
// (Jari 31.10.2026). With one visible workspace the rail has no list of one:
// it names the workspace quietly at its foot beside Lisää työtiloja. The real
// daemon moves a workspace to the Trash and back, so the rail follows the
// host's own count both ways.
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
  await expect(rail(page)).toBeVisible();
}
const rail = (page: Page) =>
  page.getByRole("navigation").and(page.getByTestId("workspace-navigation"));
const only = (page: Page) =>
  page.getByRole("region").and(page.getByTestId("rail-only-workspace"));
const list = (page: Page) => rail(page).locator(".ah-rail-workspaces");
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

test("@workspace-count one workspace: the normal rail names it and offers more", async ({
  page,
}) => {
  await signIn(page, ["ordinary-dir"]);
  await expect(page).toHaveURL(/\/workspaces$/);
  await expect(page.locator(".ah-single-bar")).toHaveCount(0);
  await expect(list(page)).toHaveCount(0);
  await expect(page.getByTestId("workspace-filter")).toHaveCount(0);
  await expect(only(page)).toBeVisible();
  // At the foot of the rail, just above the account.
  const foot = await rail(page).locator(".ah-rail-foot").boundingBox();
  const mention = await only(page).boundingBox();
  if (!foot || !mention) throw new Error("Missing rail geometry");
  expect(foot.y - (mention.y + mention.height)).toBeLessThan(40);
  await serious(page);

  // The name leads to the workspace's page, where its finished
  // conversations and its actions are.
  const name = only(page)
    .getByRole("link")
    .and(page.getByTestId("rail-only-workspace-link"));
  await expect(name).toHaveText("ordinary-dir");
  await name.click();
  await expect(page.getByTestId("workspace-title")).toHaveText("ordinary-dir");
  await expect(name).toHaveAttribute("aria-current", "page");
  // The last workspace is not moved to the Trash: the dialog says why.
  await page
    .getByRole("button")
    .and(page.getByTestId("delete-workspace"))
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("workspace-blocker")).toBeVisible();
  await expect(
    dialog.getByRole("button").and(page.getByTestId("trash-workspace")),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");

  // A conversation keeps its workspace link, as for everyone.
  await page.goto("/workspaces");
  await page.locator(".ah-home-card a").first().click();
  await expect(page.locator(".ah-agent-header h1")).toBeVisible();
  await expect(page.locator(".ah-header-workspace")).toBeVisible();
  await expect(name).not.toHaveAttribute("aria-current", "page");

  // Adding a workspace is one click away.
  await only(page)
    .getByRole("link")
    .and(page.getByTestId("workspace-create"))
    .click();
  await expect(page).toHaveURL(/\/workspaces\/new$/);

  // The old alias of home lands on the normal home page.
  await page.goto("/");
  await expect(page).toHaveURL(/\/workspaces$/);

  // The narrow rail has no workspaces button; its toggle widens it.
  await rail(page)
    .getByRole("button")
    .and(page.getByTestId("close-navigation"))
    .click();
  await expect(rail(page)).toHaveClass(/ah-rail-collapsed/);
  await expect(page.getByTestId("rail-all-workspaces")).toHaveCount(0);
  await expect(only(page)).toHaveCount(0);
  await rail(page)
    .getByRole("button")
    .and(page.getByTestId("navigation-open"))
    .click();
  await expect(only(page)).toBeVisible();

  // On the phone the same rail opens over the page.
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .locator(".ah-mobile-toolbar")
    .getByRole("button")
    .and(page.getByTestId("navigation-open"))
    .click();
  await expect(only(page)).toBeInViewport();
  await expect(
    only(page).getByRole("link").and(page.getByTestId("workspace-create")),
  ).toBeInViewport();
  await serious(page);
});

test("@workspace-count two workspaces keep the list, and the rail follows the count both ways", async ({
  page,
}) => {
  await signIn(page, ["ordinary-dir", "without-metadata"]);
  await expect(only(page)).toHaveCount(0);
  await expect(list(page)).toBeVisible();
  await expect(page.getByTestId("workspace-summary")).toHaveText("2");
  await expect(page.getByTestId("workspace-filter")).toBeVisible();
  await expect(
    list(page).getByRole("button").and(page.getByTestId("workspace-create")),
  ).toBeVisible();
  await serious(page);

  // Two to one: the second goes to the Trash, the list gives way.
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
  const notice = page.getByTestId("archive-notice");
  await expect(notice).toHaveCount(1);
  await expect(only(page)).toBeVisible();
  await expect(list(page)).toHaveCount(0);

  // One to two: Palauta brings it back, and the list with it.
  await notice
    .getByRole("button")
    .and(page.getByTestId("restore-notice"))
    .click();
  await expect(list(page)).toBeVisible();
  await expect(page.getByTestId("workspace-summary")).toHaveText("2");
  await expect(only(page)).toHaveCount(0);
});

test("@workspace-count a hidden workspace does not count and is restored from the rail", async ({
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
  await expect(only(page)).toBeVisible();
  await expect(
    only(page)
      .getByRole("link")
      .and(page.getByTestId("rail-only-workspace-link")),
  ).toHaveText("ordinary-dir");
  const archived = only(page)
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
  await expect(list(page)).toBeVisible();
  await expect(only(page)).toHaveCount(0);
});
