import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "./lab-host";

test("storage distinguishes a waiting live run, a blocked leftover and a plain worktree", async ({
  page,
}) => {
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  expect((await page.request.get("/fixture/worktrees")).status()).toBe(204);
  // The host supplies real Git rows; vary the already-classified owner at the
  // browser boundary. The native pending/interactive cause is tested in Go.
  let ended = false;
  await page.route("**/api/v1/workspaces", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const request = route.request().postDataJSON();
    if (request.action === "worktree_remove") {
      return route.fulfill({
        json: {
          schema_version: 1,
          state: "blocked",
          workspace_id: request.workspace_id,
          entry: request.entry,
          blockers: [{ kind: "process", pid: 4242, comm: "worker" }],
        },
      });
    }
    if (request.action !== "worktree_list") return route.continue();
    const response = await route.fetch();
    const json = await response.json();
    const run = json.worktrees.find(
      (w: { name: string }) => w.name === "ajossa",
    );
    run.owner = {
      run_id: "01m53433zdhmcc9q1spepb30gz",
      role: ended ? "ended" : "worker",
      state: ended ? "ended" : "waiting",
      title: "Repair search",
    };
    run.actions = ended ? ["remove"] : [];
    if (ended) run.blockers = [];
    await route.fulfill({ response, json });
  });
  await page.goto("/settings/storage");
  const row = page.getByTestId("worktree-row-ajossa");
  await expect(row).toContainText("Worker odottaa päätöstäsi");
  await expect(row).toContainText("Jatka keskustelussa");
  await expect(row.getByRole("button")).toHaveCount(0);
  await expect(row).not.toContainText("Jäänne");
  await expect(
    page.getByTestId("worktree-row-kesken").getByTestId("worktree-remove"),
  ).toBeVisible();
  const evidence = process.env.OH_WORKER_EVIDENCE;
  if (evidence) {
    await mkdir(evidence, { recursive: true });
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: join(evidence, "storage-live.png"),
      fullPage: true,
    });
    await writeFile(join(evidence, "storage-live.html"), await page.content());
  }
  ended = true;
  await page.reload();
  await expect(row).toContainText("Päättyneen ajon jäljelle jäänyt worktree");
  await row.getByTestId("worktree-remove").click();
  await page.getByRole("dialog").getByTestId("confirm-worktree").click();
  await expect(page.getByRole("dialog")).toContainText(
    "Pyydä työtilan agenttia siivoamaan se",
  );
  await expect(page.getByTestId("confirm-worktree")).toBeDisabled();
  if (evidence) {
    await page.screenshot({
      path: join(evidence, "storage-leftover.png"),
      fullPage: true,
    });
    await writeFile(
      join(evidence, "storage-leftover.html"),
      await page.content(),
    );
  }
});
