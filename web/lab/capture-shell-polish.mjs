// Paired visual evidence, synthetic lab only. Run with a managed lab host on
// OH_PORT_BASE+1; session.mjs verifies its lab marker before writing evidence.
import { expect } from "@playwright/test";
import { openLab, origin, snapshot } from "./session.mjs";

const out = "issues/browser-shell-polish/evidence";
const { browser, page } = await openLab();
try {
  // The runtime's xterm platform branch, not a claim of real macOS coverage.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "platform", { get: () => "MacIntel" });
  });
  const workspace = await page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .getByRole("link", { name: "aurinkokello", exact: true })
    .first()
    .getAttribute("href");
  if (!workspace) throw Error("No synthetic workspace");
  await page.goto(`${origin}${workspace}`);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await page.getByRole("button", { name: /^Pääte/ }).click();
  const rows = page.locator(".ah-terminal-surface .xterm-rows");
  await expect(rows).toContainText("alice@open-habitat-lab:");
  await snapshot(page, `${out}/desktop-direct-open`);
  await page.keyboard.type("printf 'selection-stays-%s\\n' 42\n");
  const row = rows.locator("div", { hasText: /^selection-stays-42/ }).first();
  await expect(row).toBeVisible();
  const box = await row.boundingBox();
  if (!box) throw Error("No selection row");
  await page.keyboard.down("Shift");
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 145, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await page.waitForTimeout(2000);
  await expect(page.locator(".xterm-selection div").first()).toBeVisible();
  await snapshot(page, `${out}/desktop-selection`);
  await page.emulateMedia({ colorScheme: "dark" });
  await snapshot(page, `${out}/desktop-selection-dark`);
  await page.getByRole("button", { name: "Vie keskusteluun" }).click();
  await expect(
    page.getByRole("textbox", { name: "Viesti Pi:lle" }),
  ).toHaveValue(/selection-stays-42/);
  await snapshot(page, `${out}/desktop-sent-to-composer`);
  await page.setViewportSize({ width: 390, height: 844 });
  await snapshot(page, `${out}/phone-panel`);
} finally {
  await browser.close();
}
