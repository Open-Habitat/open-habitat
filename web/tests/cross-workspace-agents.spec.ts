import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { createHostTest, expect } from "./worker-host";

const test = createHostTest();
test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

test("cross-workspace child belongs to target worktrees and parent spinoffs", async ({
  page,
}) => {
  await page.request.get("/fixture/conversations-reset");
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByRole("link")
    .and(page.getByTestId("workspace-ordinary-dir"))
    .click();
  await page
    .getByRole("button")
    .and(page.getByTestId("conversation-start"))
    .click();
  await page
    .getByRole("textbox")
    .and(page.getByTestId("message-input"))
    .fill("cross workspace");
  await page.getByRole("button").and(page.getByTestId("send")).click();
  await expect(page.locator("main")).toContainText(
    'Selvä. Kysyit: "cross workspace".',
    { timeout: 20000 },
  );
  const parentURL = page.url();
  const parent = new URL(parentURL).searchParams
    .get("conversation")
    ?.replace(/^pi:/, "");
  expect(parent).toMatch(/^[0-9a-f-]{36}$/);
  // Synthetic native Taskfleet create in B, attributed to the conversation in A.
  expect(
    (
      await page.request.get(`/fixture/cross-workspace?parent=${parent}`)
    ).status(),
  ).toBe(204);
  await page.reload();
  const strip = page
    .getByRole("region")
    .and(page.getByTestId("background-work"));
  await expect(
    strip.getByRole("button").and(page.getByTestId("background-spinoffs")),
  ).toBeVisible();
  await strip
    .getByRole("button")
    .and(page.getByTestId("background-spinoffs"))
    .click();
  await expect(
    strip
      .getByRole("button")
      .and(page.getByTestId("spinoff-ui-test-ok"))
      .first(),
  ).toBeVisible();
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  const target = snapshot.workspaces.find(
    (w: { name: string }) => w.name === "git-project",
  );
  await page.goto(`/workspaces/${target.workspace_id}`);
  const trees = page.getByRole("region").and(page.getByTestId("worktrees"));
  const child = trees
    .getByRole("listitem")
    .and(page.getByTestId("worktree-row-cross-worker"));
  // A working worker's row is behind the line of the rest.
  await trees
    .getByRole("button")
    .and(page.getByTestId("worktree-rest"))
    .click();
  await expect(child).toHaveAttribute("data-blocked", "true");
  // Only Git details opens; nothing removes what a live run keeps.
  await expect(child.getByRole("button")).toHaveCount(1);
  await expect(child.getByTestId("worktree-git-toggle")).toBeVisible();
  // Not a worktree of A, even though A created the run.
  const source = snapshot.workspaces.find(
    (w: { name: string }) => w.name === "ordinary-dir",
  );
  await page.goto(`/workspaces/${source.workspace_id}`);
  await expect(page.locator("main")).not.toContainText("cross-worker");
  await page.goto(parentURL);
  await expect(
    strip.getByRole("button").and(page.getByTestId("background-spinoffs")),
  ).toBeVisible();
  const a11y = await new AxeBuilder({ page }).include(".ah-bg-strip").analyze();
  expect(
    a11y.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
});
