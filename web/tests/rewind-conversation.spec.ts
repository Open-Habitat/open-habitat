import AxeBuilder from "@axe-core/playwright";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

// Palaa tähän (experimental) through the real gateway and daemon with the
// synthetic Pi standing in for the daemon's rewind extension (scenario
// pi-rewind, test/browser-host/rewind.go). The extension's own file copies
// and restores run against the pinned Pi in the daemon's native test.
test.use({
  baseURL: labOrigin,
  ignoreHTTPSErrors: true,
  reducedMotion: "reduce",
  deviceScaleFactor: 2,
});

for (const width of [1440, 390]) {
  test(`@lab Palaa tähän returns the conversation and its files and keeps the replaced continuation ${width}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 900 });
    expect(
      (await page.request.get("/fixture/conversations-reset")).status(),
    ).toBe(204);
    expect(
      (await page.request.get("/fixture/scenario?value=pi-rewind")).status(),
    ).toBe(204);
    try {
      await page.goto("/workspaces");
      await page.getByTestId("github-sign-in").click();
      await page
        .getByRole("link")
        .and(page.locator('a[href*="code=42"]'))
        .click();
      const session = await (await page.request.get("/auth/session")).json();
      expect(
        (
          await page.request.put("/api/v1/account/preferences", {
            headers: {
              Origin: new URL(page.url()).origin,
              "X-Agent-Host-CSRF": session.csrf,
            },
            data: { experimental: { "rewind-conversation": true } },
          })
        ).ok(),
      ).toBe(true);
      await page.reload();
      if (width === 390) await page.getByTestId("navigation-open").click();
      await page
        .getByRole("navigation")
        .getByTestId("workspace-aurinkokello")
        .click();
      await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
      const field = page.getByTestId("message-input");
      const send = async (text: string) => {
        await field.fill(text);
        await page
          .getByTestId("send")
          .and(page.locator('[data-mode="send"]'))
          .click();
        await expect(
          page.getByText(`Selvä. Kysyit: "${text}".`).last(),
        ).toBeVisible({ timeout: 20000 });
      };
      await send("Aloita aurinkokello");
      await send("Kirjoita tiedosto taulukolle");
      const second = page
        .getByTestId("message")
        .filter({ hasText: "Kirjoita tiedosto taulukolle" });
      // The own message's ⋯ is in the card's top-right corner, not after
      // copy at the left.
      const menu = second.getByTestId(/^message-menu-/);
      const card = second.filter({
        has: page.getByTestId(/^message-menu-/),
      });
      const [cardBox, menuBox] = await Promise.all([
        card.boundingBox(),
        menu.boundingBox(),
      ]);
      expect(cardBox && menuBox).toBeTruthy();
      expect(
        (cardBox?.x ?? 0) +
          (cardBox?.width ?? 0) -
          ((menuBox?.x ?? 0) + (menuBox?.width ?? 0)),
      ).toBeLessThan(24);
      expect((menuBox?.y ?? 0) - (cardBox?.y ?? 0)).toBeLessThan(24);
      await menu.click();
      await page.getByRole("menuitem", { name: /Palaa tähän/ }).click();

      const sheet = page.getByTestId("rewind-sheet");
      await expect(sheet).toContainText(
        "Näiden tiedostojen kaikki myöhemmät muutokset korvataan, myös omasi. Nykyinen sisältö tallennetaan ensin, jotta voit perua palautuksen.",
      );
      await expect(sheet).toBeVisible();
      await expect(sheet).toHaveAttribute("data-what", "both");
      await expect(page.getByTestId("rewind-conversation")).toContainText(
        "1 viestisi ja 1 vastaus sivuun",
      );
      await expect(page.getByTestId("rewind-files")).toContainText(
        "1 tiedosto palautuu",
      );
      await page.getByTestId("rewind-files-toggle").click();
      await expect(page.getByTestId("rewind-file-list")).toContainText(
        "palautettava.txt",
      );
      // The sheet sits whole above the composer.
      const [sheetBox, composerBox] = await Promise.all([
        sheet.boundingBox(),
        page.locator(".ah-cbox").boundingBox(),
      ]);
      expect(sheetBox && composerBox).toBeTruthy();
      expect((sheetBox?.y ?? 0) + (sheetBox?.height ?? 0)).toBeLessThanOrEqual(
        (composerBox?.y ?? 0) + 1,
      );
      expect(sheetBox?.y ?? -1).toBeGreaterThanOrEqual(0);
      const audit = await new AxeBuilder({ page })
        .include('[data-testid="rewind-sheet"]')
        .analyze();
      expect(audit.violations).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath("sheet.png") });
      // Read back up on a short page with the sheet open: the jump to the
      // latest stays a pill above the sheet, not a column as tall as the
      // sheet beside it.
      await page.setViewportSize({ width, height: 640 });
      // The wheel marks the scroll as the reader's own, as a real one does.
      await page.locator(".ah-conversation-stream").evaluate((el) => {
        el.dispatchEvent(new WheelEvent("wheel", { deltaY: -400 }));
        el.scrollTop = 0;
      });
      const jump = page.getByTestId("jump-latest");
      await expect(jump).toBeVisible();
      const [jumpBox, shortSheetBox] = await Promise.all([
        jump.boundingBox(),
        sheet.boundingBox(),
      ]);
      expect(jumpBox?.height ?? 999).toBeLessThan(56);
      expect((jumpBox?.y ?? 0) + (jumpBox?.height ?? 0)).toBeLessThanOrEqual(
        shortSheetBox?.y ?? 0,
      );
      await page.screenshot({ path: testInfo.outputPath("sheet-short.png") });
      await page.setViewportSize({ width, height: 900 });
      if (process.env.OH_VISUAL_CAPTURE === "1")
        await page.screenshot({
          path: `../issues/rewind-conversation/evidence/sheet-${width}.png`,
        });

      await page.getByTestId("rewind-go").click();
      await expect(sheet).toHaveCount(0, { timeout: 20000 });
      // The message is back in the field, the conversation continues from
      // before it, and what it replaced is one row.
      await expect(field).toHaveValue("Kirjoita tiedosto taulukolle");
      const row = page.getByTestId("rewind-branch");
      await expect(row).toContainText(
        "Aiempi jatko · 1 viestisi ja 1 vastaus · 1 tiedosto palautettu",
        { timeout: 20000 },
      );
      await expect(second).toHaveCount(0);
      await row.getByTestId("rewind-branch-toggle").click();
      await expect(page.getByTestId("rewind-branch-body")).toContainText(
        "Kirjoita tiedosto taulukolle",
      );
      await page.screenshot({ path: testInfo.outputPath("result.png") });
      if (process.env.OH_VISUAL_CAPTURE === "1")
        await page.screenshot({
          path: `../issues/rewind-conversation/evidence/result-${width}.png`,
        });

      // Continue the replaced continuation again.
      await page.getByTestId("rewind-switch").click();
      await page.getByTestId("rewind-swap-go").click();
      await expect(
        page
          .getByTestId("user-content")
          .filter({ hasText: "Kirjoita tiedosto taulukolle" }),
      ).toHaveCount(1, { timeout: 20000 });
      await expect(page.getByTestId("rewind-branch")).toContainText(
        "Aiempi jatko · ei viestejä",
      );
    } finally {
      await page.request.get("/fixture/scenario?value=ready");
    }
  });
}
