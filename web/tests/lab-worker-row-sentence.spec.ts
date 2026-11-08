import type { Page } from "@playwright/test";
import { expect, test } from "./lab-host";

// The worker-row sentence in the rail, through the real gateway, daemon and
// native Git: a worktree conversation says its work by default,
// from the snapshot's own Git summary.

async function session(page: Page) {
  const s = await (await page.request.get("/auth/session")).json();
  return {
    Origin: new URL(page.url()).origin,
    "X-Agent-Host-CSRF": s.csrf as string,
  };
}

test("@worker-row-sentence a worktree conversation in the rail says its work by default", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  expect(
    (
      await page.request.post("/api/v1/pi/models", {
        headers: await session(page),
        data: { model: "gpt-6-astra", thinking: "medium" },
      })
    ).ok(),
  ).toBeTruthy();
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("link")
    .and(page.getByTestId("workspace-aurinkokello"))
    .click();
  const main = page.locator("main");
  await main.getByRole("button").and(page.getByTestId("new-worktree")).click();
  await page
    .getByRole("textbox")
    .and(page.getByTestId("message-input"))
    .fill("Kirjoita muistiinpano ja commitoi se");
  await page.getByRole("button").and(page.getByTestId("send")).click();
  await expect(main).toContainText("Commitoin muutoksen.", { timeout: 30000 });
  const rail = page.getByRole("navigation");
  const work = rail.getByTestId("worktree-work");
  // A finished worktree conversation stays in Your turn. Keep this
  // conversation in Running with a synthetic waiting worker to exercise
  // the sentence after native Git has observed the commit.
  await expect(
    rail.getByTestId("rail-yours").locator(".ah-nav-worktree"),
  ).toHaveCount(1);
  const agentId = new URL(page.url()).searchParams.get("conversation");
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    for (const agent of body.agents)
      if (agent.agent_id === agentId) agent.spinoffs_idle = 1;
    await route.fulfill({ response, json: body });
  });
  await page.reload();
  await expect(rail.locator(".ah-nav-worktree")).toHaveCount(1);
  // One commit ahead of its base: the row says it has produced something.
  await expect(work).toHaveCount(1, { timeout: 20000 });
  await expect(work).toHaveAttribute("data-tone", "work");
  await page.screenshot({
    path: "test-results-lab/evidence/worker-row-sentence-rail.png",
  });
});
