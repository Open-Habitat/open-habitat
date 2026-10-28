#!/usr/bin/env node
// Synthetic lab only (proto-google-wizard-secrets-step): the current
// Palvelinintegraatiot › Google › Aseta tunnukset… guide, step by step, as the
// prototype round's baseline. Desktop and phone, light and dark, at device
// scale factor 2.
//   scripts/lab.sh start && node web/lab/capture-google-wizard-baseline.mjs
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { origin } from "./session.mjs";

const out = "issues/proto-google-wizard-secrets-step/baseline";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [label, width, height] of [
    ["desktop", 1280, 900],
    ["phone", 390, 844],
  ])
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        viewport: { width, height },
        deviceScaleFactor: 2,
        colorScheme: theme,
      });
      const page = await context.newPage();
      await page.goto(`${origin}/settings`);
      await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
      await page.getByRole("link", { name: "Alice", exact: true }).click();
      await page.waitForURL(/settings/);
      const r = await page.request.get(
        `${origin}/fixture/integration-apps?clear=google`,
      );
      if (r.status() !== 204) throw new Error(`fixture ${r.status()}`);
      await page.goto(`${origin}/settings/server-integrations`);
      await page
        .getByTestId("si-row-google")
        .and(page.locator("[data-status=needs_app]"))
        .waitFor();
      await page.evaluate(() => document.fonts.ready);
      const shot = (n) =>
        page.screenshot({ path: `${out}/${n}-${label}-${theme}.png` });
      await shot("00-row");
      await page.getByTestId("si-setup-google").click();
      const dialog = page.getByTestId("si-setup-dialog");
      for (const [i, step] of [
        "apis",
        "audience",
        "scopes",
        "client",
        "enter",
      ].entries()) {
        await dialog.getByTestId(`si-step-${step}`).waitFor();
        await page.waitForTimeout(250);
        await shot(`${String(i + 1).padStart(2, "0")}-${step}`);
        if (step !== "enter") await dialog.getByTestId("si-next").click();
      }
      await context.close();
    }
} finally {
  await browser.close();
}
console.log(out);
