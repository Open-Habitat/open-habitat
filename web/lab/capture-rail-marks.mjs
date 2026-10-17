// Synthetic lab only (rail-home-and-hover, rail-mark-pulse): rail hover on
// Etusivu and a conversation row, a live fake-Pi turn ("hidas" slows it) and
// a working spinoff from the lab's fake Taskfleet, as frame series so the
// pulse shows. No personal browser or live data.
// Usage: node web/lab/capture-rail-marks.mjs <before|after>
import { expect } from "@playwright/test";
import { openLab, origin, snapshot } from "./session.mjs";

const label = process.argv[2] ?? "after";
const html = label === "after";
const hoverOut = "issues/rail-home-and-hover";
const pulseOut = "issues/rail-mark-pulse";
const parent = "a1a1a1a1-0000-4000-8000-000000000001";
const { browser, page } = await openLab();
const rail = page.getByRole("navigation", { name: "Työtilat ja keskustelut" });
const taskfleet = (status) =>
  page.request.get(
    `${origin}/fixture/taskfleet?parent=${parent}&workspace=aurinkokello&status=${status}`,
  );
const frames = async (base, row) => {
  for (const n of [0, 1, 2]) {
    await row.screenshot({ path: `${base}-frame${n}.png` });
    await page.waitForTimeout(400);
  }
};
try {
  // Start from the seeded lab: no earlier capture conversations or their Pi.
  await page.request.get(`${origin}/fixture/daemon-restart`);
  await page.request.get(`${origin}/fixture/lab-conversations-clean`);
  await page.goto(`${origin}/workspaces`);
  for (const theme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: theme });
    await rail.getByRole("link", { name: "Etusivu", exact: true }).hover();
    await page.waitForTimeout(200);
    await snapshot(page, `${hoverOut}/${label}-home-hover-${theme}`, {
      html,
      region: ".ah-rail",
    });
    await rail
      .getByRole("link", { name: "Miksi CI epäonnistuu macOS:llä?" })
      .hover();
    await page.waitForTimeout(200);
    await snapshot(page, `${hoverOut}/${label}-row-hover-${theme}`, {
      html,
      region: ".ah-rail",
    });
  }
  // A working spinoff of the seeded conversation.
  expect((await taskfleet("running")).status()).toBe(204);
  await rail.getByRole("button", { name: "Päivitä", exact: true }).click();
  const spinRow = rail.locator("li.ah-waiting-spinoff");
  await expect(spinRow).toHaveCount(1);
  for (const theme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: theme });
    await page.mouse.move(900, 600);
    await frames(`${pulseOut}/${label}-spinoff-${theme}`, spinRow);
  }
  // A live turn of a new conversation.
  await page.emulateMedia({ colorScheme: "light" });
  await rail
    .getByRole("button", { name: "Uusi keskustelu työtilassa aurinkokello" })
    .click();
  await page
    .getByRole("textbox", { name: "Viesti Pi:lle" })
    .fill("hidas työ, tee rauhassa");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  const workRow = rail
    .locator("li.ah-agent-item")
    .filter({ hasText: "hidas työ" });
  await expect(workRow.getByRole("link")).toHaveAccessibleDescription(
    /Työskentelee/,
    { timeout: 15000 },
  );
  for (const theme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme: theme });
    await page.mouse.move(900, 600);
    await frames(`${pulseOut}/${label}-working-${theme}`, workRow);
    await snapshot(page, `${pulseOut}/${label}-working-rail-${theme}`, {
      html,
      region: ".ah-rail",
    });
  }
} finally {
  await taskfleet("none").catch(() => {});
  await browser.close();
}
