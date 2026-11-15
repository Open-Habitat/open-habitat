import { expect, test } from "./lab-host";

test("@worktree-containers empty and occupied containers never become workspace links", async ({
  page,
}) => {
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.getByRole("navigation").first()).toBeVisible();
  expect((await page.request.get("/fixture/worktrees")).status()).toBe(204);
  await page.goto("/workspaces");
  await expect(page.getByTestId("workspaces-title")).toBeVisible();
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  expect(
    snapshot.workspaces.some((w: { name: string }) =>
      w.name.endsWith("__worktrees"),
    ),
  ).toBe(false);
  // Check both renderers, not merely the host payload. Ordinary projects stay.
  for (const surface of [page.getByRole("navigation"), page.locator("main")]) {
    await expect(surface.getByTestId("workspace-aurinkokello")).toBeVisible();
    for (const name of [
      "aurinkokello__worktrees",
      "archived-project__worktrees",
      "removed-project__worktrees",
    ]) {
      await expect(surface.getByTestId(`workspace-${name}`)).toHaveCount(0);
    }
  }
});
