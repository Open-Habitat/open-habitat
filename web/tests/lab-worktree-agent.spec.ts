import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { archiveFromConfirmedView } from "./archive-proof";
import { expect, test } from "./lab-host";

// A worktree agent (ADR 0025) through the real gateway, daemon and native
// Git on the lab's synthetic home: the first message makes the branch and
// the worktree, the fake Pi commits and merges as an agent asked to would,
// and the top bar, rail and workspace page show what Git says afterwards.

async function accessible(page: Page, include?: string) {
  const builder = new AxeBuilder({ page }).exclude("[data-live-announcer]");
  if (include) builder.include(include);
  const result = await builder.analyze();
  expect(
    result.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
}

test("@worktree-agent @a11y create, converse, ask to merge and see it merged", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/workspaces");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const session = await (await page.request.get("/auth/session")).json();
  expect(
    (
      await page.request.post("/api/v1/pi/models", {
        headers: {
          Origin: new URL(page.url()).origin,
          "X-Agent-Host-CSRF": session.csrf,
        },
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
  await page
    .locator("main")
    .getByRole("button")
    .and(page.getByTestId("new-worktree"))
    .click();

  // Nothing exists yet: the empty conversation says what sending will do.
  const main = page.locator("main");
  await expect(main.getByTestId("worktree-intro")).toHaveAttribute(
    "data-base",
    "status-rivit",
  );
  await expect(main.getByTestId("worktree-intro")).toHaveAttribute(
    "data-dirty",
    "4",
  );
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(main.locator(".ah-composer")).toContainText("gpt-6-astra");
  await expect(main.locator(".ah-composer")).toContainText("medium");
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    for (const width of [1920, 1000, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const intro = await main.locator(".ah-worktree-intro").boundingBox();
      const composer = await main.locator(".ah-composer").boundingBox();
      if (!intro || !composer) throw new Error("Missing conversation column");
      expect(
        Math.abs(intro.x + intro.width / 2 - (composer.x + composer.width / 2)),
      ).toBeLessThan(2);
      expect(intro.x).toBeGreaterThanOrEqual(0);
      expect(intro.x + intro.width).toBeLessThanOrEqual(width);
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await accessible(page, "main");

  const editor = page
    .getByRole("textbox")
    .and(page.getByTestId("message-input"));
  const firstMessage = "Kirjoita muistiinpano ja commitoi se";
  let createRequests = 0;
  let conflict = "workspace_busy";
  await page.route("**/api/v1/conversations", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    createRequests++;
    if (!conflict) return route.continue();
    await route.fulfill({
      status: 409,
      json: { schema_version: 1, error: { code: conflict } },
    });
  });
  // The old refusal and the new named conflict both leave the exact first
  // message available. Retry clears the refusal; only Send posts again.
  for (const phase of ["before", "after"] as const) {
    await editor.fill(firstMessage);
    await page.getByRole("button").and(page.getByTestId("send")).click();

    await expect(editor).toHaveValue(firstMessage);
    await expect(main.getByTestId("creation-problem")).toBeVisible();
    await accessible(page, "main");
    if (process.env.OH_WORKTREE_CONFLICT_CAPTURE === "1") {
      const { snapshot } = await import("../lab/session.mjs");
      await snapshot(
        page,
        resolve(`../issues/worktree-agent-create-409/${phase}`),
        { labOrigin: new URL(page.url()).origin },
      );
    }
    expect(createRequests).toBe(phase === "before" ? 1 : 2);
    await page.getByRole("button").and(page.getByTestId("retry")).click();
    await expect(editor).toBeEnabled();
    await expect(editor).toHaveValue(firstMessage);
    conflict = phase === "before" ? "workspace_clone_running" : "";
  }
  expect(createRequests).toBe(2);
  await page.getByRole("button").and(page.getByTestId("send")).click();
  await expect(page).toHaveURL(/conversation=pi%3A|conversation=pi:/, {
    timeout: 30000,
  });
  await expect(main).toContainText("Commitoin muutoksen.", {
    timeout: 30000,
  });

  expect(createRequests).toBe(3);
  // The top bar reads the worktree's own Git: one commit ahead of its base.
  const chip = main.getByRole("button").and(page.getByTestId("git-chip"));
  await expect(chip).toHaveAttribute(
    "data-branch",
    "wt/kirjoita-muistiinpano-ja-commitoi",
    { timeout: 20000 },
  );
  await expect(chip).toHaveAttribute("data-base-ahead", "1", {
    timeout: 20000,
  });
  const rail = page.getByRole("navigation");
  // A finished worktree conversation rests in Hiljaiset with its worktree
  // mark; its Git state is also available here and on the workspace card.
  await expect(
    rail.getByTestId("rail-quiet").locator(".ah-nav-worktree"),
  ).toHaveCount(1);
  await chip.click();
  const details = page.getByRole("dialog").and(page.getByTestId("git-dialog"));
  await expect(details).toContainText(
    "~/src/aurinkokello__worktrees/kirjoita-muistiinpano-ja-commitoi",
  );
  await accessible(page, ".ah-gs-dialog");
  await page.keyboard.press("Escape");
  await expect(chip).toBeFocused();
  await page.screenshot({
    path: "test-results-lab/evidence/worktree-agent-desktop-2-working.png",
  });

  // Merging is asked of the agent; the browser only reads Git again.
  await editor.fill("yhdistä haara status-rivit-haaraan");
  await page.getByRole("button").and(page.getByTestId("send")).click();
  await expect(main).toContainText(
    "Yhdistin haaran wt/kirjoita-muistiinpano-ja-commitoi haaraan status-rivit.",
    { timeout: 30000 },
  );
  await expect(chip).toHaveAttribute("data-merged", "true", { timeout: 20000 });
  await expect(
    rail.getByTestId("rail-quiet").locator(".ah-nav-worktree.merged"),
  ).toHaveCount(1);
  await page.screenshot({
    path: "test-results-lab/evidence/worktree-agent-desktop-3-merged.png",
  });

  // The workspace page's card says the same.
  await rail
    .getByRole("link")
    .and(page.getByTestId("workspace-aurinkokello"))
    .click();
  const card = main.locator(".ah-home-card", {
    has: page.locator(".ah-home-card-worktree"),
  });
  await expect(card.locator(".ah-home-card-worktree")).toHaveClass(/merged/);
  await page.screenshot({
    path: "test-results-lab/evidence/worktree-agent-desktop-4-page.png",
    fullPage: true,
  });
  await accessible(page, "main");

  // A second worktree agent starts empty, not in the one just made.
  await main.getByRole("button").and(page.getByTestId("new-worktree")).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/conversation=new-worktree/);
  await page.goBack();

  // Archiving names the conversation's place, whose directory the daemon
  // checks against the native history.
  await archiveFromConfirmedView(page, () =>
    card.getByRole("button").and(page.getByTestId("archive-conversation")),
  );
  await expect(main.locator(".ah-home-card-worktree")).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goBack();
  await page.getByTestId("phone-header-facts").click();
  await expect(page.getByTestId("menu-fact-git")).toBeVisible();
  await page.getByTestId("menu-fact-git").click();
  await expect(page.getByTestId("git-dialog")).toBeVisible();
  await page.screenshot({
    path: "test-results-lab/evidence/worktree-agent-phone-merged.png",
  });
});
