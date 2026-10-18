import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
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
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "aurinkokello", exact: true })
    .click();
  await page
    .locator("main")
    .getByRole("button", {
      name: "Uusi worktree-agentti työtilassa aurinkokello",
    })
    .click();

  // Nothing exists yet: the empty conversation says what sending will do.
  const main = page.locator("main");
  await expect(main).toContainText(
    "Ensimmäinen viesti luo oman worktreen ja haaran haarasta status-rivit",
  );
  await expect(main).toContainText(
    "Työtilan 4 tallentamatonta muutosta eivät tule mukaan.",
  );
  await expect(
    page.getByRole("heading", { name: "Uusi worktree-agentti" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/worktree-agent-desktop-1-new.png",
  });
  await accessible(page, "main");

  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await editor.fill("Kirjoita muistiinpano ja commitoi se");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(page).toHaveURL(/conversation=pi%3A|conversation=pi:/, {
    timeout: 30000,
  });
  await expect(main.getByText("Commitoin muutoksen.")).toBeVisible({
    timeout: 30000,
  });

  // The top bar reads the worktree's own Git: one commit ahead of its base.
  const chip = main.getByRole("button", { name: /^Worktree-agentin haara/ });
  await expect(chip).toHaveAccessibleName(
    /^Worktree-agentin haara wt\/kirjoita-muistiinpano-ja-commitoi, 1 edellä ja 0 jäljessä status-rivit-haaraa, 0 muuttunutta tiedostoa\./,
    { timeout: 20000 },
  );
  const rail = page.getByRole("navigation");
  await expect(rail.locator(".ah-nav-worktree")).toHaveCount(1);
  await expect(rail.locator(".ah-nav-worktree.merged")).toHaveCount(0);
  await chip.click();
  const details = page.getByRole("dialog", { name: "Git-tila" });
  await expect(details).toContainText(
    "~/src/aurinkokello__worktrees/kirjoita-muistiinpano-ja-commitoi",
  );
  await accessible(page, ".ah-gs-dialog");
  await page.keyboard.press("Escape");
  await expect(chip).toBeFocused();
  await page.screenshot({
    path: "test-results/evidence/worktree-agent-desktop-2-working.png",
  });

  // Merging is asked of the agent; the browser only reads Git again.
  await editor.fill("yhdistä haara status-rivit-haaraan");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await expect(
    main.getByText(
      "Yhdistin haaran wt/kirjoita-muistiinpano-ja-commitoi haaraan status-rivit.",
    ),
  ).toBeVisible({ timeout: 30000 });
  await expect(chip).toHaveAccessibleName(
    "Worktree-agentin haara wt/kirjoita-muistiinpano-ja-commitoi, yhdistetty status-rivit-haaraan. Avaa Git-tiedot.",
    { timeout: 20000 },
  );
  await expect(rail.locator(".ah-nav-worktree.merged")).toHaveCount(1, {
    timeout: 20000,
  });
  await page.screenshot({
    path: "test-results/evidence/worktree-agent-desktop-3-merged.png",
  });

  // The workspace page's card says the same.
  await rail.getByRole("link", { name: "aurinkokello", exact: true }).click();
  const card = main.locator(".ah-home-card", {
    has: page.locator(".ah-home-card-worktree"),
  });
  await expect(card.locator(".ah-home-card-worktree")).toContainText(
    "yhdistetty status-rivit-haaraan",
  );
  await page.screenshot({
    path: "test-results/evidence/worktree-agent-desktop-4-page.png",
    fullPage: true,
  });
  await accessible(page, "main");

  await page.setViewportSize({ width: 390, height: 844 });
  await card.getByRole("link").first().click();
  await expect(chip).toBeVisible();
  await page.screenshot({
    path: "test-results/evidence/worktree-agent-phone-merged.png",
  });
});
