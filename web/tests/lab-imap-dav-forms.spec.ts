import AxeBuilder from "@axe-core/playwright";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

// Layout evidence for the two new forms, not another account-connect journey.
test("SMTP and DAV forms remain usable at desktop and phone width", async ({
  page,
}, testInfo) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await page.goto("/settings/integraatiot");
  for (const [name, kind] of [
    ["Sähköposti (IMAP)", "smtp"],
    ["Kalenteri (CalDAV)", "dav"],
  ]) {
    await page
      .locator(".ig-tile")
      .filter({ hasText: name })
      .getByRole("button", { name: "Yhdistä…" })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Jatka" }).click();
    await dialog.getByLabel("Sähköpostiosoite").fill("person@example.test");
    if (kind === "smtp")
      await dialog
        .getByLabel("SMTP-palvelin (valinnainen)")
        .fill("smtp.example.test");
    else
      await dialog
        .getByLabel("DAV-osoite (HTTPS)")
        .fill("https://dav.example.test/remote.php/dav/");
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await dialog
        .getByRole("button", { name: "Yhdistä", exact: true })
        .scrollIntoViewIfNeeded();
      const bounds = await dialog.boundingBox();
      if (!bounds) throw new Error("Integration dialog has no layout box");
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        ),
      ).toBeLessThanOrEqual(0);
      expect(
        (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
          .violations,
      ).toEqual([]);
      const { snapshot } = await import("../lab/session.mjs");
      await snapshot(page, testInfo.outputPath(`${kind}-${width}`), {
        labOrigin,
      });
    }
    await page.keyboard.press("Escape");
  }
});
