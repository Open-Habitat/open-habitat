#!/usr/bin/env node
// Git status in the top bar (issue implement-git-status-topbar): paired
// screenshots and inert HTML of the same states as the prototype round
// 2026-10-17-git-tila, from the synthetic lab only.
// Run from the repository root with the lab started:
// PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" node web/lab/capture-git-status.mjs
import { mkdir } from "node:fs/promises";
import { openLab, origin, snapshot } from "./session.mjs";

const out = "issues/implement-git-status-topbar/evidence";
await mkdir(out, { recursive: true });
const { browser, page } = await openLab();
try {
  const fixture = async (path) => {
    const response = await page.request.get(`${origin}/fixture/${path}`);
    if (response.status() !== 204) throw Error(`${path}: ${response.status()}`);
  };
  const workspace = await page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .getByRole("link", { name: "aurinkokello", exact: true })
    .first()
    .getAttribute("href");
  if (!workspace) throw Error("Missing synthetic workspace");
  await fixture("scenario?value=ready");
  await fixture("conversations-reset");
  await fixture("lab-conversations-clean");
  await page.goto(`${origin}${workspace}`);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await editor.fill("Lisää statusriveille --since-suodatus");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  const chip = page.getByRole("button", { name: /^Haara status-rivit/ });
  for (const [width, name] of [
    [1440, "desktop"],
    [390, "phone"],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    await chip.waitFor();
    await snapshot(page, `${out}/${name}-1-chip`);
    await chip.click();
    const dialog = page.getByRole("dialog", { name: "Git-tila" });
    await dialog.getByText("Tulossa", { exact: true }).waitFor();
    await dialog.locator(".ah-gs-file").first().waitFor();
    await snapshot(page, `${out}/${name}-2-details`);
    for (const label of ["Lähettämättä", "Tulossa", "Jäljessä main-haarasta"])
      await dialog.getByText(label, { exact: true }).click();
    await snapshot(page, `${out}/${name}-3-commits-open`);
    await page.keyboard.press("Escape");
  }
  // Hae etärepo last, so both widths above show the same pre-fetch state.
  await page.setViewportSize({ width: 1440, height: 900 });
  await chip.click();
  const dialog = page.getByRole("dialog", { name: "Git-tila" });
  await dialog.getByText("Jäljessä main-haarasta", { exact: true }).click();
  await dialog.getByRole("button", { name: "Hae etärepo" }).click();
  await dialog.getByText(/Etärepo haettu\. /).waitFor();
  await snapshot(page, `${out}/desktop-4-fetched`);
} finally {
  await browser.close();
}

// The prototype in the same states, for the side-by-side comparison.
{
  const { execFileSync } = await import("node:child_process");
  const { chromium } = await import("@playwright/test");
  const { resolve } = await import("node:path");
  const built = resolve(".cache/lab/proto-git-tila.html");
  execFileSync("node", [
    "design-system/prototypes/build.mjs",
    "design-system/prototypes/rounds/2026-10-17-git-tila",
    "--out",
    built,
  ]);
  const proto = await chromium.launch({ headless: true });
  try {
    for (const [width, name] of [
      [1440, "desktop"],
      [390, "phone"],
    ]) {
      const page = await proto.newPage({ viewport: { width, height: 900 } });
      await page.goto(`file://${built}`);
      await page.keyboard.press("1");
      await page.waitForTimeout(300);
      const chip = page.locator(".gs-chip");
      await chip.waitFor();
      await page.screenshot({ path: `${out}/prototype-${name}-1-chip.png` });
      await chip.click();
      await page.locator(".gs-panel").waitFor();
      await page.waitForTimeout(500); // the opening animation
      await page.screenshot({ path: `${out}/prototype-${name}-2-details.png` });
      for (const key of ["v1-unp", "v1-inc", "v1-bb"]) {
        await page.locator(`[data-key="${key}"]`).click();
        await page.waitForTimeout(300);
      }
      await page.screenshot({
        path: `${out}/prototype-${name}-3-commits-open.png`,
      });
      await page.close();
    }
  } finally {
    await proto.close();
  }
}
