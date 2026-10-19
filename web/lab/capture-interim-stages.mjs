#!/usr/bin/env node
// Paired screenshots and inert HTML of interim replies as stages, from the
// synthetic lab only, named like the prototype round's direction 3 shots.
import { openLab, origin, snapshot } from "./session.mjs";

const out = new URL(
  "../../issues/implement-interim-stages/screenshots/",
  import.meta.url,
).pathname;
const history = async (page) => {
  await page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .getByRole("link", { name: "Miksi CI epäonnistuu macOS:llä?" })
    .first()
    .click();
  await page.getByRole("button", { name: /journalctl/ }).waitFor();
  await page.waitForTimeout(500);
};
const theme = (page, value) =>
  page.evaluate(
    (value) => document.documentElement.setAttribute("data-theme", value),
    value,
  );

{
  const { browser, page } = await openLab({ width: 1440, height: 2300 });
  try {
    await history(page);
    await theme(page, "light");
    await snapshot(page, `${out}vaiheet-kiinni`);
    for (const row of await page.locator(".ah-turn-stage > button").all())
      if ((await row.getAttribute("aria-expanded")) === "false")
        await row.click();
    await theme(page, "dark");
    await page.waitForTimeout(300);
    await snapshot(page, `${out}vaiheet-auki-tumma`, { region: ".ah-feed" });
  } finally {
    await browser.close();
  }
}
{
  const { browser, page } = await openLab({ width: 390, height: 2400 });
  try {
    await page.setViewportSize({ width: 1440, height: 2400 });
    await history(page);
    await page.setViewportSize({ width: 390, height: 2400 });
    await theme(page, "light");
    await page.waitForTimeout(300);
    await snapshot(page, `${out}vaiheet-puhelin`);
  } finally {
    await browser.close();
  }
}
{
  const { browser, page } = await openLab({ width: 1440, height: 900 });
  const fixture = async (path) => {
    const response = await page.request.get(`${origin}/fixture/${path}`);
    if (response.status() !== 204) throw Error(`${path}: ${response.status()}`);
  };
  try {
    await fixture("conversations-reset");
    await fixture("scenario?value=pi-visual-hold");
    await page
      .getByRole("navigation", { name: "Työtilat ja keskustelut" })
      .getByRole("link", { name: "aurinkokello", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Aloita uusi Pi-keskustelu" })
      .click();
    await page
      .getByRole("textbox", { name: "Viesti Pi:lle" })
      .fill("Katso, mitä työtilassa on.");
    await page.getByRole("button", { name: "Lähetä", exact: true }).click();
    await page.locator(".ah-message-interim").waitFor({ timeout: 20000 });
    await page.getByText("Ajaa bash").waitFor({ timeout: 20000 });
    await page.waitForTimeout(1200);
    await snapshot(page, `${out}vaiheet-elava`);
    await page.getByRole("button", { name: "Näytä työ" }).click();
    await page.waitForTimeout(400);
    await snapshot(page, `${out}vaiheet-elava-auki`);
  } finally {
    await fixture("scenario?value=ready").catch(() => {});
    await browser.close();
  }
}
