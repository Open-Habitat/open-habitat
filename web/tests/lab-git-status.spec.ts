import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./lab-host";

// Git status in the conversation's top bar (Yläpalkissa). The lab's
// aurinkokello is a real clone of a bare repository in the synthetic home,
// in the state of the prototype round 2026-10-17-git-tila.
for (const width of [1440, 390]) {
  test(`@git-status @a11y top-bar chip, details and Hae etätiedot at ${width}px`, async ({
    page,
  }) => {
    await page.goto("/workspaces");
    await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await page.getByRole("link", { name: "Alice", exact: true }).click();
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "aurinkokello", exact: true })
      .click();
    await page
      .locator("main")
      .getByRole("button", { name: "Aloita uusi Pi-keskustelu", exact: true })
      .click();
    await page.setViewportSize({ width, height: 900 });
    const chip = page.locator("main").getByRole("button", {
      name: /^Haara status-rivit/,
    });
    await expect(chip).toHaveAccessibleName(
      "Haara status-rivit, 2 lähettämättä ja 1 tulossa origin/status-rivit-haarasta, 5 edellä ja 3 jäljessä main-haaraa, 4 muuttunutta tiedostoa. Avaa Git-tiedot.",
    );
    await expect(chip).toBeVisible();
    // The branch name drops out of the chip on a phone; the arrows stay.
    await expect(chip.locator(".ah-gs-chip-branch")).toBeVisible({
      visible: width > 700,
    });
    await chip.click();
    const details = page.getByRole("dialog", { name: "Git-tila" });
    await expect(details.locator(".ah-gs-file")).toHaveCount(4);
    await expect(details).toContainText("+18");
    await expect(details).toContainText("Etärepo haettu 25 min sitten");
    const behind = details.locator("details", {
      hasText: "Jäljessä main-haarasta",
    });
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
    const fetch = details.getByRole("button", { name: "Hae etätiedot" });
    await fetch.click();
    await expect(details.getByRole("status")).toHaveText(
      "Etätiedot haettu. origin/status-rivit: 1 tulossa. main: 4 jäljessä.",
    );
    await expect(behind.locator(".ah-gs-commit").first()).toContainText(
      "Korjaa maanantain CI-aikakatkaisu",
    );
    await expect(details).toContainText("Etärepo haettu juuri nyt");
    await expect(chip).toHaveAccessibleName(/4 jäljessä main-haaraa/);
    await page.keyboard.press("Escape");
    await expect(details).toHaveCount(0);
    await expect(chip).toBeFocused();
  });
}
