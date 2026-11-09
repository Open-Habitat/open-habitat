import AxeBuilder from "@axe-core/playwright";
import { snapshot } from "../lab/session.mjs";
import type { Spinoff } from "../src/app/spinoffs";
import { hostOrigin } from "../test-ports.mjs";
import { createHostTest, expect } from "./worker-host";

const captureAlignment = process.env.OH_RESTORE_ALIGNMENT_CAPTURE === "1";
const capture = process.env.OH_VISUAL_CAPTURE === "1" || captureAlignment;
const test = createHostTest(false, capture ? { BROWSER_HOST_LAB: "1" } : {});
const workspaceTestId = capture
  ? "workspace-aurinkokello"
  : "workspace-ordinary-dir";

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});

test("helpers confirm before archive, stay discoverable, and return without starting or merging", async ({
  page,
}) => {
  let helpers: Spinoff[] = [
    {
      run_id: "01m6r1q934veb852ke10x2r3ac",
      title: "Accessibility review",
      created_at: "2026-11-08T12:00:00Z",
      state: "working",
      preserved: false,
      branch: "wt/review",
      worktree: "/synthetic/review",
      source_branch: "main",
      summary: "",
      resident: {
        name: "reviewer",
        round_state: "working",
        rounds: 1,
        landed_round: 1,
      },
    },
  ];
  let readable = true;
  await page.route("**/api/v1/agents/pi:*/spinoffs**", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        parent_id: new URL(route.request().url()).pathname
          .split("/agents/")[1]
          .split("/spinoffs")[0],
        availability: readable ? "available" : "unavailable",
        runs: readable
          ? helpers.map((run) =>
              new URL(route.request().url()).searchParams.has("run")
                ? run
                : { ...run, branch: "", worktree: "" },
            )
          : [],
        transcripts: [],
      },
    }),
  );
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const { csrf } = await (await page.request.get("/auth/session")).json();
  expect(
    (
      await page.request.put("/api/v1/account/preferences", {
        headers: {
          Origin: new URL(page.url()).origin,
          "X-Agent-Host-CSRF": csrf,
        },
        data: { experimental: { "named-workers": true } },
      })
    ).ok(),
  ).toBeTruthy();
  await page.reload();
  await page.getByRole("navigation").getByTestId(workspaceTestId).click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  const id = new URL(page.url()).searchParams.get("conversation") ?? "";
  await page.getByTestId("message-input").fill("Review this page");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(page.getByTestId("message-input")).toBeEnabled();
  const rail = page.getByRole("navigation").getByTestId(`agent-item-${id}`);
  const archive = rail.getByTestId("rail-archive-conversation");
  await expect(
    page.getByTestId("rail-yours").getByTestId(`agent-item-${id}`),
  ).toBeVisible({ timeout: 25000 });
  await expect(archive).toBeEnabled({ timeout: 25000 });
  let writes = 0;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith("/api/v1/workspaces") &&
      request.postDataJSON()?.action === "conversation_archive"
    )
      writes++;
  });
  await archive.click();
  const confirm = page.getByTestId("helper-archive-confirm");
  await expect(confirm.getByTestId("helper-archive-row")).toHaveCount(1);
  expect(writes).toBe(0);
  if (process.env.OH_VISUAL_CAPTURE)
    await snapshot(
      page,
      "../issues/helper-archive-flow/evidence/confirmation",
      { labOrigin: new URL(page.url()).origin },
    );
  expect(
    (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(confirm).toHaveCount(0);
  expect(writes).toBe(0);
  await expect(archive).toBeFocused();
  // An unavailable read is not evidence that there are no helpers.
  readable = false;
  await archive.click();
  await expect(confirm).toBeVisible();
  await expect(confirm.getByTestId("helper-archive-row")).toHaveCount(0);
  await page.getByTestId("helper-archive-cancel").click();
  readable = true;
  await archive.click();
  await page.getByTestId("helper-archive-accept").click();
  await expect(rail).toHaveCount(0);
  expect(writes).toBe(1);
  await expect(page.getByTestId("archive-notice-detail")).toHaveCount(1);
  await expect(page.getByTestId("archive-notice-detail")).toContainText(
    "reviewer",
  );
  await page.getByRole("navigation").getByTestId(workspaceTestId).click();
  await page.locator(".ah-workspace-archive > summary").click();
  const archived = page.getByTestId("workspace-archive-panel");
  // The row names the helper in two words; its own row, with the branch,
  // is where the conversation is read.
  const row = archived
    .getByTestId("archive-row")
    .filter({ has: page.getByTestId("archive-traces") });
  await expect(row.getByTestId("archive-traces")).toContainText(
    "avustaja reviewer",
  );
  await expect(row.locator("time")).toHaveCount(1);
  await expect(archived.getByTestId("helper-archive-row")).toHaveCount(0);
  await row.getByTestId("archive-row-open").click();
  const foot = page.getByTestId("archived-foot");
  await expect(foot.getByTestId("helper-archive-row")).toHaveCount(1);
  await expect(page.getByTestId("message-input")).toHaveCount(0);
  await page.goBack();
  await expect(row).toBeVisible();
  if (process.env.OH_VISUAL_CAPTURE)
    await snapshot(page, "../issues/helper-archive-flow/evidence/archive", {
      labOrigin: new URL(page.url()).origin,
    });
  helpers = helpers.map((r) => ({
    ...r,
    state: "waiting_parent",
    resident: {
      name: "reviewer",
      landed_round: 1,
      round_state: "waiting",
      rounds: 2,
      unlanded: true,
      report: "Review completed",
    },
  }));
  await row.getByTestId("restore-conversation").click();
  await expect(archived.getByTestId("archive-restored")).toContainText(
    "avustajat palasivat",
  );
  await expect(rail).toBeVisible();
  await rail.getByTestId("agent-link").click();
  const note = page.getByTestId("helper-restore-note");
  await expect(note.getByTestId("helper-archive-row")).toHaveCount(1);
  await note.scrollIntoViewIfNeeded();
  if (process.env.OH_VISUAL_CAPTURE)
    await snapshot(page, "../issues/helper-archive-flow/evidence/restored", {
      labOrigin: new URL(page.url()).origin,
    });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await note.scrollIntoViewIfNeeded();
    const neighbour = page
      .locator('.ah-feed > li[data-kind="assistant"]')
      .last();
    await expect(neighbour).toBeVisible();
    await expect(async () => {
      const restoredBox = await note.boundingBox();
      const feedBox = await neighbour.boundingBox();
      if (!restoredBox || !feedBox) throw new Error("Missing conversation box");
      expect(Math.abs(restoredBox.x - feedBox.x)).toBeLessThan(1);
      expect(Math.abs(restoredBox.width - feedBox.width)).toBeLessThan(1);
      expect(restoredBox.x).toBeGreaterThan(0);
      expect(restoredBox.x + restoredBox.width).toBeLessThan(width);
    }).toPass();
    if (captureAlignment)
      await snapshot(
        page,
        `../issues/restored-helpers-box-misaligned/evidence/restored-${width}`,
        { labOrigin: new URL(page.url()).origin },
      );
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await note.getByTestId("helper-archive-branch").click();
  await expect(page.getByTestId("helper-branch-name")).toHaveText("wt/review");
  await page.keyboard.press("Escape");
  // A later archive must remove this tab's restore marker even with helpers present.
  await archive.click();
  await page.getByTestId("helper-archive-accept").click();
  await expect(rail).toHaveCount(0);
  await expect(page.getByTestId("archive-notice")).toBeVisible();
  await expect(page.getByTestId("archive-notice-detail")).toHaveCount(0);
  await page.getByRole("navigation").getByTestId(workspaceTestId).click();
  await archived.locator(`a[href*="${id}"]`).click();
  await expect(page.getByTestId("helper-restore-note")).toHaveCount(0);
  expect(writes).toBe(3);
});
