import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./lab-host";

// Worktree cleanup from the UI (ADR 0025) through the real gateway, CSRF
// check and daemon handler on a synthetic home: Git's registry, the removal
// walk, the commit to the branch and the Taskfleet guard are the production
// code paths.

async function signIn(page: Page) {
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.getByRole("navigation").first()).toBeVisible();
}

const section = (page: Page) =>
  page.getByRole("region").and(page.getByTestId("worktrees"));
const row = (page: Page, name: string) =>
  page.getByRole("listitem").and(page.getByTestId(`worktree-row-${name}`));
const dialog = (page: Page) => page.getByRole("dialog");
async function accessible(page: Page) {
  const result = await new AxeBuilder({ page })
    .exclude("[data-live-announcer]")
    .analyze();
  expect(
    result.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
}

test("@worktree-cleanup list, prune, remove, save, force and clean merged", async ({
  page,
}) => {
  // A button that just became enabled is mid-transition for 120 ms, which
  // axe would read as a contrast failure.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page);
  expect((await page.request.get("/fixture/worktrees")).status()).toBe(204);
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  const workspace = snapshot.workspaces.find(
    (w: { name: string }) => w.name === "aurinkokello",
  );
  await page.goto(`/workspaces/${workspace.workspace_id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "aurinkokello",
  );

  // Buffer the real reply at the network boundary. Chromium can evict a
  // response body from CDP before response.json() reads it during busy runs.
  // Fulfil with the original response; the application still validates it.
  const results: { state: string; branch_kept?: string; committed?: string }[] =
    [];
  await page.route("**/api/v1/workspaces", async (route) => {
    if (
      route.request().method() !== "POST" ||
      route.request().postDataJSON()?.action !== "worktree_remove"
    ) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    const result = await response.json();
    expect(response.ok(), JSON.stringify(result)).toBe(true);
    await route.fulfill({ response });
    results.push(result);
  });
  const removal = async (index: number) => {
    await expect.poll(() => results.length).toBe(index + 1);
    return results[index];
  };

  // Each Git state, and the removals the host offers for it.
  // The row a live run keeps takes care of itself: it is behind the one
  // line of the rest until opened.
  await expect(section(page).getByRole("listitem")).toHaveCount(5);
  await section(page)
    .getByRole("button")
    .and(page.getByTestId("worktree-rest"))
    .click();
  await expect(section(page).getByRole("listitem")).toHaveCount(6);
  await expect(row(page, "valmis")).toHaveAttribute("data-state", "merged");
  await expect(row(page, "kesken")).toHaveAttribute("data-state", "unmerged");
  await expect(row(page, "muokattu")).toHaveAttribute("data-state", "dirty");
  await expect(row(page, "kadonnut")).toHaveAttribute("data-state", "missing");
  await expect(row(page, "ajossa")).toHaveAttribute("data-blocked", "true");
  // Only Git details opens; nothing removes what a live run keeps.
  await expect(row(page, "ajossa").getByRole("button")).toHaveCount(1);
  await expect(
    row(page, "ajossa").getByTestId("worktree-git-toggle"),
  ).toBeVisible();
  await expect(
    row(page, "muokattu")
      .getByRole("button")
      .and(page.getByTestId("worktree-commit")),
  ).toBeVisible();
  await section(page).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results-lab/evidence/worktree-cleanup-workspace-desktop.png",
    fullPage: true,
  });
  await accessible(page);

  // A missing directory: only Git's entry goes, without a dialog.
  await row(page, "kadonnut")
    .getByRole("button")
    .and(page.getByTestId("worktree-prune"))
    .click();
  expect((await removal(0)).state).toBe("pruned");
  await expect(section(page).getByRole("status")).toBeVisible();
  await expect(row(page, "kadonnut")).toHaveCount(0);

  // Not merged: the checkout goes, the branch stays.
  await row(page, "kesken")
    .getByRole("button")
    .and(page.getByTestId("worktree-remove"))
    .click();
  await expect(dialog(page)).toBeVisible();
  await dialog(page)
    .getByRole("button")
    .and(page.getByTestId("confirm-worktree"))
    .click();
  expect((await removal(1)).branch_kept).toBe("not_merged");
  await expect(section(page).getByRole("status")).toBeVisible();
  await expect(row(page, "kesken")).toHaveCount(0);

  // Uncommitted changes saved to the branch first.
  await row(page, "muokattu")
    .getByRole("button")
    .and(page.getByTestId("worktree-commit"))
    .click();
  await expect(dialog(page)).toBeVisible();
  await page.screenshot({
    path: "test-results-lab/evidence/worktree-cleanup-save-dialog.png",
  });
  await dialog(page)
    .getByRole("button")
    .and(page.getByTestId("confirm-worktree"))
    .click();
  expect((await removal(2)).committed).toMatch(/^[0-9a-f]{40}$/);
  await expect(section(page).getByRole("status")).toBeVisible();
  await expect(row(page, "muokattu")).toHaveCount(0);

  // Forced: only once the name is typed.
  await row(page, "hylatty")
    .getByRole("button")
    .and(page.getByTestId("worktree-force"))
    .click();
  const force = dialog(page)
    .getByRole("button")
    .and(page.getByTestId("confirm-worktree"));
  await expect(force).toBeDisabled();
  await dialog(page).getByRole("textbox").fill("hylatty");
  await page.screenshot({
    path: "test-results-lab/evidence/worktree-cleanup-force-dialog.png",
  });
  await accessible(page);
  await force.click();
  const forceResult = await removal(3);
  expect(forceResult.state).toBe("removed");
  await expect(section(page).getByRole("status")).toBeVisible();

  await expect(row(page, "hylatty")).toHaveCount(0);
  expect(forceResult.branch_kept).toBe("not_merged");

  // Asetukset › Tallennustila lists every workspace's worktrees and cleans
  // the merged ones it showed.
  await page.goto("/settings/storage");
  await expect(row(page, "valmis")).toContainText("aurinkokello");
  await expect(section(page).getByRole("listitem")).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await section(page).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results-lab/evidence/worktree-cleanup-storage-phone.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await section(page)
    .getByRole("button")
    .and(page.getByTestId("cleanup-worktrees"))
    .click();
  await expect(dialog(page)).toContainText("valmis");
  await dialog(page)
    .getByRole("button")
    .and(page.getByTestId("confirm-cleanup"))
    .click();
  await expect(section(page).getByRole("status")).toBeVisible();
  await expect(row(page, "valmis")).toHaveCount(0);
  await expect(row(page, "ajossa")).toHaveCount(1);
  await accessible(page);
});
