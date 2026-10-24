import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

// Uusi työtila as a page (Kloonaussivulla, Jari 17.10.2026) through the real
// gateway and daemon clone jobs (ADR 0024) on a synthetic home. Only the git
// and gh programs are synthetic; /fixture/clone holds or fails their clone.

test.use({ baseURL: labOrigin, ignoreHTTPSErrors: true });

async function signIn(page: Page) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}
async function openPage(page: Page) {
  await page
    .locator("main")
    .getByRole("button")
    .and(page.getByTestId("workspace-create"))
    .click();
  await expect(page).toHaveURL(/\/workspaces\/new$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}
async function choose(page: Page, name: string) {
  await page
    .getByRole("searchbox")
    .and(page.getByTestId("repository-search"))
    .fill(name);
  await page
    .locator("main")
    .getByRole("link")
    .and(page.getByTestId(`repository-option-${name}`))
    .first()
    .click();
  await expect(
    page.getByRole("complementary").and(page.getByTestId("repo-details")),
  ).toContainText(name.split("/")[1]);
}
const card = (page: Page, name: string) =>
  page
    .getByRole("article")
    .and(page.getByTestId("clone-job"))
    .and(page.locator(`[data-repository="${name}"]`));
const railBlock = (page: Page) =>
  page
    .getByRole("navigation")
    .getByRole("link")
    .and(page.getByTestId("clone-jobs"));
const posts = async (page: Page) =>
  Number(await (await page.request.get("/fixture/clone-count")).text());

test("@lab @a11y a clone succeeds, is opened from its card and the page passes axe", async ({
  page,
}) => {
  await signIn(page);
  await openPage(page);
  // The catalog in sections; the organisation repo is on page 1 here, and
  // an exact owner/repo outside the catalog is looked up on GitHub.
  await expect(
    page.getByRole("heading").and(page.getByTestId("repo-owner-synthetic-org")),
  ).toBeVisible();
  await expect(
    page.getByRole("button").and(page.getByTestId("expand-repos")),
  ).toBeVisible();
  await page
    .getByRole("searchbox")
    .and(page.getByTestId("repository-search"))
    .fill("nobody/missing");
  await expect(page.getByTestId("repo-lookup")).toHaveAttribute(
    "data-state",
    "not_found",
  );
  await page
    .getByRole("searchbox")
    .and(page.getByTestId("repository-search"))
    .fill("public-org/workmux");
  await page
    .getByRole("link")
    .and(page.getByTestId("repository-option-public-org/workmux"))
    .click();
  await expect(page).toHaveURL(/repo=public-org%2Fworkmux/);
  await expect(
    page.getByRole("complementary").and(page.getByTestId("repo-details")),
  ).toContainText("Synthetic lookup");
  const result = await new AxeBuilder({ page })
    .exclude("[data-live-announcer]")
    .analyze();
  expect(
    result.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);

  const before = await posts(page);
  await choose(page, "fixture/last");
  await page
    .getByRole("button")
    .and(page.getByTestId("repository-clone"))
    .click();
  const job = card(page, "fixture/last");
  await expect(job).toHaveAttribute("data-state", "confirmed", {
    timeout: 15000,
  });
  expect(await posts(page)).toBe(before + 1);
  await job
    .getByRole("button")
    .and(page.getByTestId("cloned-workspace-open"))
    .click();
  // A fresh clone gets its first conversation (Jari 16.10.2026).
  await expect(page).toHaveURL(/conversation=pi:/, { timeout: 20000 });
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link")
      .and(page.getByTestId("workspace-last")),
  ).toBeVisible();
  // Opening forgets the finished job; nothing is left for the rail.
  await expect(railBlock(page)).toHaveCount(0);
});

test("@lab the person can leave during a clone and come back through the rail", async ({
  page,
}) => {
  await page.request.get("/fixture/clone?mode=hold");
  await signIn(page);
  await openPage(page);
  await choose(page, "fixture/last");
  await page
    .getByRole("button")
    .and(page.getByTestId("repository-clone"))
    .click();
  const job = card(page, "fixture/last");
  await expect(job.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "14",
  );
  // A second clone waits: one runs at a time.
  await choose(page, "fixture/older");
  await expect(
    page.getByRole("button").and(page.getByTestId("repository-clone")),
  ).toBeDisabled();
  const elsewhere = page.locator(".ah-rail-content .ah-workspace-link").first();
  const name = (await elsewhere.innerText()).trim();
  await elsewhere.click();
  await expect(page.locator("main h1")).toHaveText(name);
  await expect(railBlock(page)).toBeVisible();
  await expect(railBlock(page)).toHaveAttribute("data-live", "true");
  // A reload loses nothing: the job is the daemon's.
  await page.reload();
  await expect(railBlock(page)).toHaveAttribute("data-live", "true");
  await railBlock(page).click();
  await expect(page).toHaveURL(/\/workspaces\/new$/);
  await expect(
    card(page, "fixture/last").getByRole("progressbar"),
  ).toHaveAttribute("aria-valuenow", "14");
  await page.request.get("/fixture/clone?mode=release");
  await expect(card(page, "fixture/last")).toHaveAttribute(
    "data-state",
    "confirmed",
    {
      timeout: 15000,
    },
  );
  await expect(railBlock(page)).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link")
      .and(page.getByTestId("workspace-last")),
  ).toBeVisible();
});

test("@lab a failed clone leaves nothing and its retry succeeds", async ({
  page,
}) => {
  await page.request.get("/fixture/clone?mode=fail-once");
  await signIn(page);
  await openPage(page);
  await choose(page, "fixture/last");
  await page
    .getByRole("button")
    .and(page.getByTestId("repository-clone"))
    .click();
  const job = card(page, "fixture/last");
  await expect(job).toHaveAttribute("data-state", "failed", { timeout: 15000 });
  await expect(job).toBeVisible();
  await expect(railBlock(page)).toBeVisible();
  const before = await posts(page);
  await job.getByRole("button").and(page.getByTestId("retry")).click();
  await expect(job).toHaveAttribute("data-state", "confirmed", {
    timeout: 15000,
  });
  // The failed attempt's notice is forgotten once the retry started.
  await expect(page.getByTestId("clone-failed")).toHaveCount(0);
  expect(await posts(page)).toBe(before + 2); // start + dismiss
});

test("@lab a running clone is cancelled only after confirmation", async ({
  page,
}) => {
  await page.request.get("/fixture/clone?mode=hold");
  await signIn(page);
  await openPage(page);
  await choose(page, "fixture/last");
  await page
    .getByRole("button")
    .and(page.getByTestId("repository-clone"))
    .click();
  const job = card(page, "fixture/last");
  await expect(job.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "14",
  );
  await job.getByRole("button").and(page.getByTestId("cancel-clone")).click();
  await expect(job.getByTestId("continue-clone")).toBeVisible();
  await job.getByRole("button").and(page.getByTestId("continue-clone")).click();
  await expect(job.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "14",
  );
  await job.getByRole("button").and(page.getByTestId("cancel-clone")).click();
  await job.getByRole("button").and(page.getByTestId("cancel-clone")).click();
  await expect(job).toHaveCount(0, { timeout: 15000 });
  await expect(railBlock(page)).toHaveCount(0);
  const seen = await (
    await page.request.get(
      "/api/v1/onboarding/github/checkout?full_name=fixture%2Flast",
    )
  ).json();
  expect(seen.state).toBe("absent");
});

// A clone cut by a daemon restart leaves a .git without commits. It is not a
// workspace; the page and the rail show it, and only Aloita alusta or Poista
// keskeneräinen act on it (Jari 17.10.2026: never by itself).
test("@lab an interrupted clone is restarted or removed only explicitly", async ({
  page,
}) => {
  await page.request.get("/fixture/checkout?name=first&mode=interrupted");
  await page.request.get("/fixture/checkout?name=second&mode=interrupted");
  await signIn(page);
  await expect(
    page
      .locator("main")
      .getByRole("link")
      .and(page.getByTestId("workspace-first")),
  ).toHaveCount(0);
  await expect(railBlock(page)).toBeVisible();
  const before = await posts(page);
  await railBlock(page).click();
  const first = card(page, "fixture/first");
  const second = card(page, "fixture/second");
  await expect(first).toHaveAttribute("data-state", "interrupted");
  await expect(second).toHaveAttribute("data-state", "interrupted");
  // Nothing restarted by itself.
  expect(await posts(page)).toBe(before);
  await second
    .getByRole("button")
    .and(page.getByTestId("remove-clone"))
    .click();
  await expect(page).toHaveURL(/\/workspaces$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await railBlock(page).click();
  await expect(second).toHaveCount(0);
  await first
    .getByRole("button")
    .and(page.getByTestId("restart-clone"))
    .click();
  await expect(card(page, "fixture/first")).toHaveAttribute(
    "data-state",
    "confirmed",
    {
      timeout: 15000,
    },
  );
  expect(await posts(page)).toBe(before + 2);
  await expect(railBlock(page)).toHaveCount(0);
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link")
      .and(page.getByTestId("workspace-first")),
  ).toBeVisible();
});

test("@lab on a phone the list and the details are shown one at a time", async ({
  page,
}) => {
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/workspaces/new");
  await choose(page, "fixture/last");
  await expect(
    page.getByRole("searchbox").and(page.getByTestId("repository-search")),
  ).toBeHidden();
  await page.getByRole("link").and(page.getByTestId("all-repos")).click();
  await expect(page).toHaveURL(/\/workspaces\/new$/);
  await expect(
    page.getByRole("searchbox").and(page.getByTestId("repository-search")),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary").and(page.getByTestId("repo-details")),
  ).toBeHidden();
});

// Jari's prototype observations (17.10.2026): the details pane scrolls on its
// own within the window, and the search field's focus ring is not covered.
test("@lab the details stay in view and the search ring is whole", async ({
  page,
}) => {
  await signIn(page);
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto("/workspaces/new");
  const search = page
    .getByRole("searchbox")
    .and(page.getByTestId("repository-search"));
  await search.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(search).toBeFocused();
  const ring = await page.evaluate(() => {
    const field = document.querySelector(".ah-clone-search");
    const above = document.querySelector(".ah-clone-card > fieldset");
    if (!field || !above) return undefined;
    const outline = Number.parseFloat(getComputedStyle(field).outlineWidth);
    const offset = Number.parseFloat(getComputedStyle(field).outlineOffset);
    return {
      drawn: getComputedStyle(field).outlineStyle !== "none" && outline > 0,
      room:
        field.getBoundingClientRect().top -
        above.getBoundingClientRect().bottom,
      needed: outline + offset,
    };
  });
  expect(ring?.drawn).toBe(true);
  expect(ring?.room).toBeGreaterThanOrEqual(ring?.needed ?? 99);
  // A large repository: the warning and Kevyt klooni make the pane tall.
  await choose(page, "fixture/second");
  await expect(page.getByTestId("blobless-clone")).toBeVisible();
  const details = page
    .getByRole("complementary")
    .and(page.getByTestId("repo-details"));
  await page
    .getByRole("searchbox")
    .and(page.getByTestId("repository-search"))
    .fill("");
  await page
    .getByRole("button")
    .and(page.getByTestId("expand-repos"))
    .first()
    .click();
  // Scroll the list well down but not past its end: the pane stays whole.
  await page.locator("main").evaluate((main) => {
    const list = main.querySelector(".ah-clone-finder");
    main.scrollTop = Math.max(
      0,
      (list?.getBoundingClientRect().bottom ?? 0) - main.clientHeight * 1.2,
    );
  });
  expect(
    await page.locator("main").evaluate((main) => main.scrollTop),
  ).toBeGreaterThan(200);
  const box = await details.boundingBox();
  expect(box?.y).toBeGreaterThanOrEqual(0);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(600);
  // The pane scrolls by itself to its Kloonaa button.
  await page
    .getByRole("button")
    .and(page.getByTestId("repository-clone"))
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button").and(page.getByTestId("repository-clone")),
  ).toBeInViewport();
  expect(
    await page.locator("main").evaluate((main) => main.scrollTop),
  ).toBeGreaterThan(0);
});

const capture = process.env.OH_VISUAL_CAPTURE === "1" ? test : test.skip;
// Review material for the pairwise comparison with the prototype round
// 2026-10-17-repon-valinta (issues/repo-selection-page/result.md).
capture(
  "@lab @visual clone page states for the prototype comparison",
  async ({ page }) => {
    test.setTimeout(120000);
    await page.request.get("/fixture/checkout?name=first&mode=interrupted");
    await page.request.get("/fixture/clone?mode=hold");
    await signIn(page);
    await page.goto("/workspaces/new");
    await choose(page, "fixture/last");
    await page
      .getByRole("button")
      .and(page.getByTestId("repository-clone"))
      .click();
    await expect(
      card(page, "fixture/last").getByRole("progressbar"),
    ).toHaveAttribute("aria-valuenow", "14");
    for (const theme of ["light", "dark"] as const) {
      await page.evaluate((choice) => {
        localStorage.setItem("nah:theme", choice);
        document.documentElement.dataset.theme = choice;
      }, theme);
      for (const [form, width, height] of [
        ["desktop", 1280, 900],
        ["phone", 390, 844],
      ] as const) {
        await page.setViewportSize({ width, height });
        await page.goto("/workspaces/new");
        await expect(card(page, "fixture/first")).toBeVisible();
        await page.locator("main").evaluate((main) => {
          main.scrollTop = 0;
        });
        await page.screenshot({
          path: `test-results/evidence/clone-page-jobs-${form}-${theme}.png`,
        });
        await page.goto("/workspaces/new?repo=fixture%2Fsecond");
        await expect(page.getByTestId("blobless-clone")).toBeVisible();
        await page
          .getByRole("complementary")
          .and(page.getByTestId("repo-details"))
          .scrollIntoViewIfNeeded();
        await page.screenshot({
          path: `test-results/evidence/clone-page-details-${form}-${theme}.png`,
        });
        if (form === "phone") {
          await page
            .getByRole("button")
            .and(page.getByTestId("navigation-open"))
            .click();
          await page.screenshot({
            path: `test-results/evidence/clone-page-rail-${form}-${theme}.png`,
          });
          await page
            .getByRole("button")
            .and(page.getByTestId("close-navigation"))
            .click();
        }
      }
    }
    await page.request.get("/fixture/clone?mode=release");
  },
);

// The Gitea walking path (ADR 0031) on a synthetic HTTPS Gitea with real Git:
// the approved form → the connection's repositories in the same list as
// GitHub's → an ordinary clone job → a workspace → the workspace's own fetch,
// which the native helper answers from the same tea entry.
async function connectGitea(page: Page) {
  const { url, token } = await (
    await page.request.get("/fixture/gitea?action=enable")
  ).json();
  await signIn(page);
  await page.goto("/settings/integrations");
  const giteaTile = page.getByTestId("integration-tile-gitea");
  await giteaTile
    .getByRole("button")
    .and(giteaTile.getByTestId("integration-connect-open"))
    .click();
  const dialog = page.getByRole("dialog").and(page.getByTestId("gitea-dialog"));
  await dialog.getByTestId("gitea-address").fill(url);
  await dialog.getByTestId("gitea-token").fill(token);
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("gitea-submit"))
    .click();
  await expect(dialog.getByTestId("gitea-connected")).toHaveAttribute(
    "data-git",
    "registered",
  );
  await dialog
    .getByRole("button")
    .and(dialog.getByTestId("gitea-done"))
    .click();
}
test("@lab a Gitea repository is cloned from the common list into a workspace and fetched", async ({
  page,
}) => {
  await connectGitea(page);
  await page.goto("/workspaces/new");
  const search = page
    .getByRole("searchbox")
    .and(page.getByTestId("repository-search"));
  // The same owner/repo on GitHub and on the Gitea are two rows.
  await search.fill("fixture/first");
  const first = page
    .locator("main")
    .getByRole("link")
    .and(page.getByTestId("repository-option-fixture/first"));
  await expect(first).toHaveCount(2);
  await expect(first.and(page.locator('[data-source="gitea"]'))).toHaveCount(1);
  // An empty repository cannot be cloned yet.
  await search.fill("fixture/blank");
  await page
    .locator("main")
    .getByRole("link")
    .and(page.getByTestId("repository-option-fixture/blank"))
    .click();
  await expect(
    page.getByRole("button").and(page.getByTestId("repository-clone")),
  ).toBeDisabled();

  await search.fill("fixture/notes");
  await page
    .locator("main")
    .getByRole("link")
    .and(page.getByTestId("repository-option-fixture/notes"))
    .and(page.locator('[data-source="gitea"]'))
    .click();
  await expect(page).toHaveURL(/gitea=gitea_[0-9a-f]{24}%2F2001/);
  await expect(page.getByTestId("repo-details-source")).toBeVisible();
  await page
    .getByRole("button")
    .and(page.getByTestId("repository-clone"))
    .click();
  const job = card(page, "fixture/notes");
  await expect(job).toHaveAttribute("data-state", "confirmed", {
    timeout: 20000,
  });
  await job
    .getByRole("button")
    .and(page.getByTestId("cloned-workspace-open"))
    .click();
  await expect(page).toHaveURL(/conversation=pi:/, { timeout: 20000 });

  await page.request.get("/fixture/gitea?action=commit");
  const chip = page
    .locator("main")
    .getByRole("button")
    .and(page.getByTestId("git-chip"));
  await expect(chip).toHaveAttribute("data-upstream-behind", "0", {
    timeout: 15000,
  });
  await chip.click();
  const details = page.getByRole("dialog").and(page.getByTestId("git-dialog"));
  await details.getByRole("button").and(page.getByTestId("fetch-git")).click();
  await expect(chip).toHaveAttribute("data-upstream-behind", "1", {
    timeout: 20000,
  });

  // Back in the list the daemon has matched the clone's origin to this
  // Gitea's repository: its row is the workspace and offers to open it.
  await page.goto("/workspaces/new");
  await page
    .getByRole("searchbox")
    .and(page.getByTestId("repository-search"))
    .fill("fixture/notes");
  const notes = page
    .locator("main")
    .getByRole("link")
    .and(page.getByTestId("repository-option-fixture/notes"))
    .and(page.locator('[data-source="gitea"]'));
  await expect(notes).toHaveAttribute("data-workspace", "same", {
    timeout: 15000,
  });
  await notes.click();
  await expect(page.getByTestId("repo-details")).toHaveAttribute(
    "data-state",
    "workspace",
  );
});

const giteaRow = (page: Page, name: string) =>
  page
    .locator("main")
    .getByRole("link")
    .and(page.getByTestId(`repository-option-${name}`))
    .and(page.locator('[data-source="gitea"]'));
const githubRow = (page: Page, name: string) =>
  page
    .locator("main")
    .getByRole("link")
    .and(page.getByTestId(`repository-option-${name}`))
    .and(page.locator('[data-source="github"]'));
async function search(page: Page, name: string) {
  await page
    .getByRole("searchbox")
    .and(page.getByTestId("repository-search"))
    .fill(name);
}

// A Gitea clone is the daemon's job like a GitHub one: it goes on while the
// person is elsewhere, is cancelled only after confirmation, and a start the
// daemon refused (the server was unwell) can simply be asked for again.
test("@lab a Gitea clone outlives leaving the page, is cancelled on confirmation and retried", async ({
  page,
}) => {
  await connectGitea(page);
  await page.request.get("/fixture/gitea?action=hold");
  await page.goto("/workspaces/new");
  await search(page, "fixture/notes");
  await giteaRow(page, "fixture/notes").click();
  await page
    .getByRole("button")
    .and(page.getByTestId("repository-clone"))
    .click();
  const job = card(page, "fixture/notes");
  await expect(job).toHaveAttribute("data-state", "running");
  // Elsewhere and back through the rail, after a reload: the job is still
  // the same running clone.
  const elsewhere = page.locator(".ah-rail-content .ah-workspace-link").first();
  await elsewhere.click();
  await expect(railBlock(page)).toHaveAttribute("data-live", "true");
  await page.reload();
  await railBlock(page).click();
  await expect(page).toHaveURL(/\/workspaces\/new$/);
  await expect(card(page, "fixture/notes")).toHaveAttribute(
    "data-state",
    "running",
  );
  await job.getByRole("button").and(page.getByTestId("cancel-clone")).click();
  await job.getByRole("button").and(page.getByTestId("continue-clone")).click();
  await expect(job).toHaveAttribute("data-state", "running");
  await job.getByRole("button").and(page.getByTestId("cancel-clone")).click();
  await job.getByRole("button").and(page.getByTestId("cancel-clone")).click();
  await expect(job).toHaveCount(0, { timeout: 15000 });
  await page.request.get("/fixture/gitea?action=release");
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link")
      .and(page.getByTestId("workspace-notes")),
  ).toHaveCount(0);

  // The server is unwell: the start is refused before anything is written.
  await page.request.get("/fixture/gitea?action=fail");
  await search(page, "fixture/notes");
  await giteaRow(page, "fixture/notes").click();
  const clone = page
    .getByRole("button")
    .and(page.getByTestId("repository-clone"));
  await clone.click();
  const details = page
    .getByRole("complementary")
    .and(page.getByTestId("repo-details"));
  await expect(details.getByRole("alert")).toBeVisible();
  await expect(card(page, "fixture/notes")).toHaveCount(0);
  await page.request.get("/fixture/gitea?action=recover");
  await clone.click();
  await expect(card(page, "fixture/notes")).toHaveAttribute(
    "data-state",
    "confirmed",
    { timeout: 20000 },
  );
});

// The same fixture/first on GitHub and on the Gitea are two repositories:
// each has its own route and details, a clone of one makes ~/src/first a name
// conflict for the other, and a Gitea that stops answering is reported on
// its own while GitHub's list stays.
test("@lab namesakes stay apart by route and by workspace, and a failing Gitea hides no other list", async ({
  page,
}) => {
  await connectGitea(page);
  await page.goto("/workspaces/new");
  await search(page, "fixture/first");
  await githubRow(page, "fixture/first").click();
  await expect(page).toHaveURL(/repo=fixture%2Ffirst/);
  await expect(page.getByTestId("repo-details-source")).toHaveCount(0);
  await expect(githubRow(page, "fixture/first")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await giteaRow(page, "fixture/first").click();
  await expect(page).toHaveURL(/gitea=gitea_[0-9a-f]{24}%2F2002/);
  await expect(page.getByTestId("repo-details-source")).toBeVisible();
  await expect(githubRow(page, "fixture/first")).not.toHaveAttribute(
    "aria-current",
    "page",
  );
  await page
    .getByRole("button")
    .and(page.getByTestId("repository-clone"))
    .click();
  await expect(card(page, "fixture/first")).toHaveAttribute(
    "data-state",
    "confirmed",
    { timeout: 20000 },
  );
  await page.goto("/workspaces/new");
  await search(page, "fixture/first");
  await expect(giteaRow(page, "fixture/first")).toHaveAttribute(
    "data-workspace",
    "same",
    { timeout: 15000 },
  );
  await expect(githubRow(page, "fixture/first")).toHaveAttribute(
    "data-workspace",
    "taken",
  );
  await githubRow(page, "fixture/first").click();
  await expect(page.getByTestId("repo-details")).toHaveAttribute(
    "data-state",
    "taken",
  );
  // Nothing offers to clone over the other repository's directory.
  await expect(
    page.getByRole("button").and(page.getByTestId("repository-clone")),
  ).toHaveCount(0);

  await page.request.get("/fixture/gitea?action=fail");
  await page.goto("/workspaces/new");
  const note = page.getByTestId("repository-source-note");
  await expect(note).toHaveAttribute("data-failed", "");
  await search(page, "fixture/first");
  await expect(githubRow(page, "fixture/first")).toBeVisible();
  await expect(giteaRow(page, "fixture/first")).toHaveCount(0);
});

// A Gitea clone cut by a daemon restart is an interrupted clone like
// GitHub's: shown, never restarted by itself, restarted as its connection's
// repository or removed only when the person asks.
test("@lab an interrupted Gitea clone is restarted or removed only explicitly", async ({
  page,
}) => {
  await connectGitea(page);
  await page.request.get("/fixture/checkout?name=notes&mode=gitea-interrupted");
  await page.request.get("/fixture/checkout?name=first&mode=gitea-interrupted");
  const before = await posts(page);
  await page.goto("/workspaces/new");
  const notes = card(page, "fixture/notes");
  const first = card(page, "fixture/first");
  await expect(notes).toHaveAttribute("data-state", "interrupted");
  await expect(first).toHaveAttribute("data-state", "interrupted");
  await expect(
    page
      .getByRole("navigation")
      .getByRole("link")
      .and(page.getByTestId("workspace-notes")),
  ).toHaveCount(0);
  expect(await posts(page)).toBe(before);
  await first.getByRole("button").and(page.getByTestId("remove-clone")).click();
  await expect(page).toHaveURL(/\/workspaces$/);
  await page.goto("/workspaces/new");
  await expect(card(page, "fixture/first")).toHaveCount(0);
  await notes
    .getByRole("button")
    .and(page.getByTestId("restart-clone"))
    .click();
  await expect(card(page, "fixture/notes")).toHaveAttribute(
    "data-state",
    "confirmed",
    { timeout: 20000 },
  );
  expect(await posts(page)).toBe(before + 2);
});
