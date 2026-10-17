#!/usr/bin/env node
// Synthetic lab only (composer-focus-ring-clipped): the focused editor under
// the recap card and the background strip, desktop and phone, light and dark.
//   node web/lab/capture-composer-focus.mjs <before|after>
import { origin, openLab, snapshot } from "./session.mjs";

const label = process.argv[2];
if (!["before", "after"].includes(label))
  throw new Error("usage: capture-composer-focus.mjs before|after");
const out = "issues/composer-focus-ring-clipped";
const { browser, page } = await openLab();
page.setDefaultTimeout(20000);
const fixture = async (path) => {
  const response = await page.request.get(`${origin}/fixture/${path}`);
  if (response.status() !== 204) throw new Error(`fixture ${path}`);
};
// The lab's fake Pi has no process extension; a synthetic inventory shows the strip.
await page.route("**/api/v1/conversations/*/processes**", (route) =>
  route.fulfill({
    json: {
      schema_version: 1,
      owner_generation: "og_lab",
      availability: "available",
      unavailable_reason: null,
      interrupted: [],
      processes: [
        {
          id: "proc_7d40",
          name: "hidas-testi",
          command_preview: "python3 -m pytest tests/slow -q",
          process_token: "pt_proc_7d40",
          status: "running",
          started_at: Date.now() - 120000,
          ended_at: null,
          exit_code: null,
          signal: null,
          end_reason: null,
          wakes_agent: false,
          run_ids: [],
        },
      ],
    },
  }),
);
try {
  for (const [form, width, height] of [
    ["desktop", 1280, 800],
    ["phone", 390, 844],
  ]) {
    await fixture("daemon-restart");
    await fixture("lab-conversations-clean");
    await fixture("scenario?value=pi-recap");
    await page.setViewportSize({ width, height });
    await page.goto(`${origin}/workspaces`);
    if (width < 600)
      await page.getByRole("button", { name: "Avaa navigaatio" }).click();
    await page
      .getByRole("navigation", { name: "Työtilat ja keskustelut" })
      .getByRole("button", { name: "Uusi keskustelu työtilassa aurinkokello" })
      .click();
    const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
    await editor.fill("Tutki synteettinen työtila");
    await page.getByRole("button", { name: "Lähetä", exact: true }).click();
    await page
      .getByRole("complementary", { name: "Keskustelun yhteenveto" })
      .getByText("luotu automaattisesti")
      .waitFor();
    await page.getByRole("region", { name: "Taustatyö" }).waitFor();
    for (const theme of ["light", "dark"]) {
      await page.evaluate((t) => localStorage.setItem("nah:theme", t), theme);
      await page.reload();
      await page.getByRole("region", { name: "Taustatyö" }).waitFor();
      await page.waitForTimeout(500);
      await page.getByRole("textbox", { name: "Viesti Pi:lle" }).focus();
      await page.waitForTimeout(200);
      await snapshot(page, `${out}/${label}-${form}-${theme}`);
    }
  }
} finally {
  await fixture("scenario?value=ready").catch(() => {});
  await browser.close();
}
