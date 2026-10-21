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
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
}
const rail = (page: Page) =>
  page.getByRole("navigation", { name: "Työtilat ja keskustelut" });
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
  await expect(
    page.getByRole("heading", { name: "Keskustelut" }),
  ).toBeVisible();
  await expect(rail(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/);
  const home = bar(page).getByRole("link", { name: "ordinary-dir" });
  await expect(home).toHaveAttribute("aria-current", "page");
  const create = bar(page).getByRole("button", {
    name: "Uusi keskustelu",
    exact: true,
  });
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
    .getByRole("button", { name: "Työtilan ordinary-dir toiminnot" })
    .click();
  const trash = page.getByRole("menuitem", { name: /Siirrä roskakoriin/ });
  await expect(trash).toBeDisabled();
  await expect(trash).toContainText(
    "Tämä on ainoa työtilasi, joten sitä ei voi siirtää roskakoriin.",
  );
  await expect(
    page.getByRole("menuitem", { name: "Lisää työtila…" }),
  ).toBeEnabled();
  // A plain directory has no worktree agents.
  await expect(
    page.getByRole("menuitem", { name: /worktree-agentti/ }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");

  // The server and its connection moved into the account menu.
  await bar(page)
    .getByRole("button", { name: /Tilivalikko/ })
    .click();
  await expect(page.locator(".ah-account-server")).toContainText("Yhdistetty");
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
  await expect(
    page.getByRole("heading", { name: "Keskustelut" }),
  ).toBeVisible();

  // On the phone the bar replaces the navigation drawer.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(bar(page)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Avaa navigaatio" }),
  ).toHaveCount(0);
  await expect(
    bar(page).getByRole("button", { name: "Uusi keskustelu" }),
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
    .getByRole("link", { name: "without-metadata", exact: true })
    .click();
  await page.getByRole("button", { name: "Poista työtila…" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Siirrä roskakoriin" })
    .click();
  await expect(notice(page)).toContainText("Siirretty roskakoriin");
  await expect(notice(page)).toContainText(
    "Jäljellä on yksi työtila, joten näkymä keskittyy siihen.",
  );
  await expect(bar(page)).toBeVisible();
  await expect(rail(page)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Keskustelut" }),
  ).toBeVisible();

  // One to two: Palauta brings it back, and the sidebar with it.
  await notice(page).getByRole("button", { name: "Palauta" }).click();
  await expect(rail(page)).toBeVisible();
  await expect(bar(page)).toHaveCount(0);
  await expect(notice(page)).toContainText(
    "Työtiloja on nyt kaksi, joten sivupalkki näyttää ne ryhminä.",
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "without-metadata" }),
  ).toBeVisible();
});

test("@single-workspace a hidden workspace does not count and is restored from home", async ({
  page,
}) => {
  await signIn(page, ["ordinary-dir", "without-metadata"]);
  await rail(page)
    .getByRole("link", { name: "without-metadata", exact: true })
    .click();
  await page.getByRole("button", { name: "Arkistoi työtila" }).click();
  await expect(bar(page)).toBeVisible();
  await expect(rail(page)).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({ hasText: "Kumoa" }),
  ).toContainText("Löydät sen etusivun lopusta");
  await bar(page).getByRole("link", { name: "ordinary-dir" }).click();
  const archived = page.getByRole("region", { name: "Arkistoidut työtilat" });
  await archived.getByRole("button", { name: "Arkistoidut" }).click();
  await archived
    .getByRole("button", { name: "Palauta without-metadata" })
    .click();
  await expect(rail(page)).toBeVisible();
  await expect(notice(page).last()).toContainText("Työtiloja on nyt kaksi");
});

test("@single-workspace a Git workspace offers a worktree agent from the menu", async ({
  page,
}) => {
  await signIn(page, ["git-project"]);
  await bar(page)
    .getByRole("button", { name: "Työtilan git-project toiminnot" })
    .click();
  const item = page.getByRole("menuitem", { name: /Uusi worktree-agentti/ });
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
  await expect(warning).toContainText("Arkistoa ei voitu kokonaan tarkistaa");
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
