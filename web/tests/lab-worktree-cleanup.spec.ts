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

  const results: { state: string; branch_kept?: string; committed?: string }[] =
    [];
  page.on("response", async (response) => {
    if (
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/v1/workspaces" &&
      response.request().postDataJSON()?.action === "worktree_remove" &&
      response.ok()
    ) {
      results.push(await response.json());
    }
  });

  // Each Git state, and the removals the host offers for it.
  await expect(section(page).getByRole("listitem")).toHaveCount(6);
  await expect(row(page, "valmis")).toHaveAttribute("data-state", "merged");
  await expect(row(page, "kesken")).toHaveAttribute("data-state", "unmerged");
  await expect(row(page, "muokattu")).toHaveAttribute("data-state", "dirty");
  await expect(row(page, "kadonnut")).toHaveAttribute("data-state", "missing");
  await expect(row(page, "ajossa")).toHaveAttribute("data-blocked", "true");
  await expect(row(page, "ajossa").getByRole("button")).toHaveCount(0);
  await expect(
    row(page, "muokattu")
      .getByRole("button")
      .and(page.getByTestId("worktree-commit")),
  ).toBeVisible();
  await section(page).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/evidence/worktree-cleanup-workspace-desktop.png",
    fullPage: true,
  });
  await accessible(page);

  // A missing directory: only Git's entry goes, without a dialog.
  await row(page, "kadonnut")
    .getByRole("button")
    .and(page.getByTestId("worktree-prune"))
    .click();
  await expect(section(page).getByRole("status")).toBeVisible();
  await expect(row(page, "kadonnut")).toHaveCount(0);
  await expect.poll(() => results[0]?.state).toBe("pruned");

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
  await expect(section(page).getByRole("status")).toBeVisible();
  await expect(row(page, "kesken")).toHaveCount(0);
  await expect.poll(() => results[1]?.branch_kept).toBe("not_merged");

  // Uncommitted changes saved to the branch first.
  await row(page, "muokattu")
    .getByRole("button")
    .and(page.getByTestId("worktree-commit"))
    .click();
  await expect(dialog(page)).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/worktree-cleanup-save-dialog.png",
  });
  await dialog(page)
    .getByRole("button")
    .and(page.getByTestId("confirm-worktree"))
    .click();
  await expect(section(page).getByRole("status")).toBeVisible();

  await expect(row(page, "muokattu")).toHaveCount(0);
  await expect.poll(() => results[2]?.committed).toMatch(/^[0-9a-f]{40}$/);

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
    path: "test-results/evidence/worktree-cleanup-force-dialog.png",
  });
  await accessible(page);
  await force.click();
  await expect(section(page).getByRole("status")).toBeVisible();

  await expect(row(page, "hylatty")).toHaveCount(0);
  await expect.poll(() => results[3]?.branch_kept).toBe("not_merged");

  // Asetukset › Tallennustila lists every workspace's worktrees and cleans
  // the merged ones it showed.
  await page.goto("/settings/tallennustila");
  await expect(row(page, "valmis")).toContainText("aurinkokello");
  await expect(section(page).getByRole("listitem")).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await section(page).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/evidence/worktree-cleanup-storage-phone.png",
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
