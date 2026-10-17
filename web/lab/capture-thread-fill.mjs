// Synthetic lab and accepted prototype only (implement-bottom-fill): the
// Alhaalta direction of round 2026-10-16-tayttosuunta against production in
// the empty, first-message, long-reply and recap states. Build the round
// first: node design-system/prototypes/build.mjs rounds/2026-10-16-tayttosuunta

import { resolve } from "node:path";
import { expect } from "@playwright/test";
import { openLab, origin, snapshot } from "./session.mjs";

const out = "issues/implement-bottom-fill";
const round = `file://${resolve("design-system/prototypes/dist/2026-10-16-tayttosuunta.html")}`;
const { browser, page, context } = await openLab();
const proto = await context.newPage();
const scenario = (value) =>
  page.request.get(`${origin}/fixture/scenario?value=${value}`);

async function protoState(state, width, theme) {
  await proto.setViewportSize({ width: width + 32, height: 1050 });
  await proto.goto(round);
  await proto.keyboard.press("2");
  await proto.selectOption("#theme", theme);
  await proto.locator("#phone").setChecked(width === 390);
  await proto.addStyleTag({
    content: `.frame {width:${width}px!important; max-width:none!important; flex-shrink:0!important; height:900px!important}`,
  });
  if (state === "empty")
    await expect(proto.locator(".fill-empty")).toBeVisible();
  if (state !== "empty")
    await expect(proto.locator(".bubble.user").first()).toBeVisible({
      timeout: 10000,
    });
  if (state === "long-reply" || state === "recap")
    await expect(proto.locator(".turn.working")).toHaveCount(0, {
      timeout: 90000,
    });
  if (state === "recap")
    await expect(proto.locator(".recap")).toBeVisible({ timeout: 15000 });
  await proto.locator(".frame").screenshot({
    path: `${out}/round-${state}-${width === 390 ? "phone" : "desktop"}-${theme}.png`,
  });
}

async function labState(state, width, theme) {
  // Each state starts from the seeded lab: no earlier test conversations or
  // their Pi children holding the synthetic host's limits.
  await page.request.get(`${origin}/fixture/daemon-restart`);
  await page.request.get(`${origin}/fixture/lab-conversations-clean`);
  await scenario(state === "recap" ? "pi-recap" : "ready");
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ colorScheme: theme });
  await page.goto(`${origin}/workspaces`);
  if (width === 390)
    await page.getByRole("button", { name: "Avaa navigaatio" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Uusi keskustelu työtilassa aurinkokello" })
    .click();
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await expect(editor).toBeVisible();
  if (state !== "empty") {
    const text =
      state === "long-reply"
        ? "Selitä pitkä vastaus: miten skripti valitsee rivit?"
        : "Testit kaatuvat scripts/status_rows.py:ssä. Korjaa ne.";
    await editor.fill(text);
    await page.getByRole("button", { name: "Lähetä", exact: true }).click();
    await expect(page.getByText(/Selvä\. Kysyit/).first()).toBeVisible({
      timeout: 30000,
    });
  }
  if (state === "recap")
    await expect(
      page.getByRole("complementary", { name: "Keskustelun yhteenveto" }),
    ).toBeVisible({ timeout: 60000 });
  await page.waitForTimeout(400);
  await snapshot(
    page,
    `${out}/lab-${state}-${width === 390 ? "phone" : "desktop"}-${theme}`,
  );
}

try {
  // Optional argument: one state to capture again.
  const only = process.argv[2];
  for (const state of ["empty", "first-message", "long-reply", "recap"].filter(
    (s) => !only || s === only,
  ))
    for (const width of [1440, 390])
      for (const theme of ["light", "dark"]) {
        await protoState(state, width, theme);
        await labState(state, width, theme);
      }
} finally {
  await scenario("ready").catch(() => {});
  await browser.close();
}
