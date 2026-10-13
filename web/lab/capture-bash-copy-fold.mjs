#!/usr/bin/env node
// Paired evidence only from the synthetic lab; no real profiles or data.
import { readFile, writeFile } from "node:fs/promises";
import { openLab, origin, snapshot } from "./session.mjs";

async function capture(page, base, options) {
  await snapshot(page, base, options);
  const html = `${base}.html`;
  await writeFile(
    html,
    (await readFile(html, "utf8")).replace(/[ \t]+$/gm, ""),
  );
}

const { browser, page } = await openLab();
const base = "issues/bash-card-copy-fold";
try {
  const fixture = async (path) => {
    const reply = await page.request.get(`${origin}/fixture/${path}`);
    if (reply.status() !== 204) throw Error(`${path}: ${reply.status()}`);
  };
  const workspace = await page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .getByRole("link", { name: "aurinkokello", exact: true })
    .first()
    .getAttribute("href");
  if (!workspace) throw Error("Missing synthetic workspace route");
  const themeSet = async (theme) =>
    page.evaluate(
      (value) => document.documentElement.setAttribute("data-theme", value),
      theme,
    );
  const send = async (text) => {
    await page
      .getByRole("button", { name: "Aloita uusi Pi-keskustelu" })
      .click();
    await page.getByRole("textbox", { name: "Viesti Pi:lle" }).fill(text);
    await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  };
  for (const width of [1440, 390])
    for (const theme of ["light", "dark"]) {
      await page.setViewportSize({ width, height: 900 });
      await fixture("scenario?value=ready");
      await fixture("conversations-reset");
      await fixture("lab-conversations-clean");
      await page.goto(`${origin}${workspace}`);
      await themeSet(theme);
      await send("Tutki synteettinen työtila");
      await page
        .getByText(/Selvä. Kysyit:/)
        .last()
        .waitFor({ timeout: 30000 });
      const short = page.locator(".ah-tool-row:has(.ah-bash-card)").first();
      if (
        (await short
          .getByRole("button", { name: /bash/ })
          .getAttribute("aria-expanded")) === "false"
      )
        await short.getByRole("button", { name: /bash/ }).click();
      await short.getByRole("button", { name: "Kopioi tuloste" }).waitFor();
      await capture(page, `${base}/lab-${width}-${theme}-short`, {
        region: ".ah-tool-row:has(.ah-bash-card)",
      });

      await page.reload();
      await themeSet(theme);
      await page
        .getByRole("button", { name: /bash.*valmis/ })
        .first()
        .waitFor();
      await page
        .getByRole("button", { name: /bash.*valmis/ })
        .first()
        .locator('xpath=ancestor::*[contains(@class,"ah-agent-turn")]')
        .evaluate((el) => el.setAttribute("data-bash-loaded-capture", ""));
      await capture(page, `${base}/lab-${width}-${theme}-loaded`, {
        region: "[data-bash-loaded-capture]",
      });

      await fixture("scenario?value=pi-visual-hold");
      await page.goto(`${origin}${workspace}`);
      await themeSet(theme);
      await send("Näytä pitkä tuloste");
      await page
        .locator(".ah-live-tool-row")
        .first()
        .waitFor({ timeout: 15000 });
      await capture(page, `${base}/lab-${width}-${theme}-live`, {
        region: ".ah-agent-turn:has(.ah-live-tool-row)",
      });
      await fixture("scenario?value=ready");
      await page
        .getByText(/Selvä. Kysyit:/)
        .last()
        .waitFor({ timeout: 30000 });
      const long = page.locator(".ah-tool-row:has(.ah-bash-card)").last();
      if (
        (await long
          .getByRole("button", { name: /bash/ })
          .getAttribute("aria-expanded")) === "false"
      )
        await long.getByRole("button", { name: /bash/ }).click();
      await long.getByRole("button", { name: "Kopioi tuloste" }).waitFor();
      await capture(page, `${base}/lab-${width}-${theme}-long`, {
        region: ".ah-tool-row:has(.ah-bash-card)",
      });
      await page
        .getByRole("textbox", { name: "Viesti Pi:lle" })
        .fill("Vertaa `>=`, `==`, `::` ja `|-` koodina");
      await page.getByRole("button", { name: "Lähetä", exact: true }).click();
      await page.getByText("Vertaa", { exact: false }).last().waitFor();
      await page
        .locator(".ah-message:has(.ah-user-content)")
        .last()
        .evaluate((el) => el.setAttribute("data-bash-code-capture", ""));
      await capture(page, `${base}/lab-${width}-${theme}-code`, {
        region: "[data-bash-code-capture]",
      });
    }
} finally {
  await browser.close();
}
