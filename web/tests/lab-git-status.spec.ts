import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./lab-host";

// Git status in the conversation's top bar (Yläpalkissa). The lab's
// aurinkokello is a real clone of a bare repository in the synthetic home,
// in the state of the prototype round 2026-10-17-git-tila.
for (const width of [1440, 390]) {
  test(`@git-status @a11y top-bar chip, details and Päivitä tila at ${width}px`, async ({
    page,
  }) => {
    await page.goto("/workspaces");
    await page
      .getByRole("button")
      .and(page.getByTestId("github-sign-in"))
      .click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=42"]'))
      .click();
    await page
      .getByRole("navigation")
      .getByRole("link")
      .and(page.getByTestId("workspace-aurinkokello"))
      .click();
    await page
      .locator("main")
      .getByRole("button")
      .and(page.getByTestId("conversation-start"))
      .click();
    await page.setViewportSize({ width, height: 900 });
    const phone = width === 390;
    // On a phone the chip leaves the bar for the facts line (Alarivi, Jari
    // 6.11.2026); it stays mounted and still owns the Git layer.
    const chip = phone
      ? page.locator("main").getByTestId("git-chip")
      : page
          .locator("main")
          .getByRole("button")
          .and(page.getByTestId("git-chip"));
    await expect(chip).toHaveAttribute("data-branch", "status-rivit");
    await expect(chip).toHaveAttribute("data-base-behind", "3");
    await expect(chip).toHaveAttribute("data-changes", "4");
    const facts = page.getByTestId("phone-header-facts");
    if (phone) {
      // The line carries the same marks, not the branch; the facts menu's
      // Git row names the branch and opens the layer.
      const marks = facts.locator(".ah-phone-git");
      await expect(marks).toBeVisible();
      await expect(marks).toContainText("4");
      await expect(marks).not.toContainText("status-rivit");
      await facts.click();
      const row = page
        .getByRole("menuitem")
        .and(page.getByTestId("menu-fact-git"));
      await expect(row).toContainText("status-rivit");
      await row.click();
    } else {
      await expect(chip).toBeVisible();
      // The chip carries the marks, not the branch (proto-conversation-header
      // round 2): the name is in its accessible name and the layer's heading.
      // Zero counts are left out.
      await expect(chip).not.toContainText("status-rivit");
      await expect(chip).toHaveAttribute("aria-label", /status-rivit/);
      await expect(chip).toContainText("4");
      await expect(chip.locator(".zero")).toHaveCount(0);
      await chip.click();
    }
    const details = page
      .getByRole("dialog")
      .and(page.getByTestId("git-dialog"));
    await expect(details.locator(".ah-gs-file")).toHaveCount(4);
    await expect(details).toContainText("+18");
    await expect(details).toBeVisible();
    const behind = details.getByTestId("git-commits-in").last();
    await behind.locator("summary").click();
    await expect(behind.locator(".ah-gs-commit")).toHaveText([
      /CI: pip-välimuisti/,
      /Aikavyöhyke tulosteeseen/,
      /Päivitä riippuvuudet/,
    ]);
    const result = await new AxeBuilder({ page })
      .include(".ah-gs-dialog")
      .analyze();
    expect(
      result.violations.filter((v) =>
        ["serious", "critical"].includes(v.impact ?? ""),
      ),
    ).toEqual([]);
    // A real git fetch from the bare repository: main has one commit the
    // last fetch had not seen. Focus stays in the layer while it runs.
    const fetch = details
      .getByRole("button")
      .and(page.getByTestId("fetch-git"));
    await fetch.click();
    await expect(details.getByRole("status")).toBeVisible();
    await expect(behind.locator(".ah-gs-commit").first()).toContainText(
      "Korjaa maanantain CI-aikakatkaisu",
    );
    await expect(details).toBeVisible();
    await expect(chip).toHaveAttribute("data-base-behind", "4");
    await page.keyboard.press("Escape");
    await expect(details).toHaveCount(0);
    await expect(phone ? facts : chip).toBeFocused();
  });
}
