#!/usr/bin/env node
import { resolve } from "node:path";
// Rebuild the 21 synthetic morning-review views in sequence (fixture switch is global).
import { chromium } from "@playwright/test";
import { origin, snapshot } from "./session.mjs";

const browser = await chromium.launch();
const context = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const base = resolve("issues/overnight-ui-review/pages");
const shot = async (name) => {
  await page.evaluate(() => document.fonts.ready);
  await snapshot(page, `${base}/${name}`);
  console.log(name);
};
const fixture = async (path) => {
  const r = await page.request.get(`${origin}/fixture/${path}`);
  if (r.status() !== 204) throw new Error(`${path}: ${r.status()}`);
};
const go = async (route) => {
  await page.goto(`${origin}${route}`);
  await page.locator("main").waitFor();
  await page.waitForTimeout(350);
};
const ready = async () => {
  await fixture("scenario?value=ready");
  await fixture("pi-state?value=usable");
  await go("/workspaces");
  if (await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).count()) {
    await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
    await page.getByRole("link", { name: "Alice", exact: true }).click();
  }
};
try {
  await fixture("scenario?value=pi-onboarding");
  await fixture("pi-state?value=missing");
  await go("/workspaces");
  await shot("signin");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await page
    .getByRole("heading", { name: "Valitse GitHub-repot haettaviksi" })
    .waitFor();
  await shot("chooser");
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: /jatka/i }).click();
  await page.getByRole("heading", { name: "ChatGPT-kirjautuminen" }).waitFor();
  await shot("pi-start");
  await page.getByRole("button", { name: "Aloita kirjautuminen" }).click();
  await page.getByText("ABCD-1234").waitFor();
  await shot("pi-code");
  await ready();
  await page.getByRole("heading", { name: "Työtilat", exact: true }).waitFor();
  await shot("landing");
  await page.setViewportSize({ width: 390, height: 844 });
  await shot("narrow-landing");
  await page.setViewportSize({ width: 1440, height: 900 });
  const workspace = await page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .getByRole("link", { name: "aurinkokello", exact: true })
    .first()
    .getAttribute("href");
  const history = "/agents/pi:a1a1a1a1-0000-4000-8000-000000000001";
  if (!workspace || !history) throw new Error("Missing synthetic lab routes");
  await go(workspace);
  await shot("workspace");
  await go(history);
  await shot("history");
  await page.setViewportSize({ width: 390, height: 844 });
  await shot("narrow-history");
  await page.setViewportSize({ width: 1440, height: 900 });
  await fixture("conversations-reset");
  await go(workspace);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  await page.getByRole("textbox", { name: "Viesti Pi:lle" }).waitFor();
  await shot("chat-new");
  let editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await editor.fill("hidas tarkistus");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await page.getByText("Katson ensin, mitä työtilassa on.").waitFor();
  await shot("chat-working");
  await page
    .getByText(/Selvä. Kysyit:/)
    .last()
    .waitFor({ timeout: 30000 });
  await shot("chat-answer");
  const tool = page.getByRole("button", { name: /bash.*Tulos valmis/ }).first();
  if (await tool.count()) await tool.click();
  await shot("tool-group");
  await go(history);
  await page
    .getByText("Tuntematon sisältö", { exact: false })
    .first()
    .waitFor();
  await shot("unknown-content");
  await go(workspace);
  await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu" }).click();
  editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  await editor.fill("hylkää");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await page
    .getByText("Viesti hylättiin.", { exact: false })
    .waitFor({ timeout: 20000 });
  await shot("chat-rejected");
  const conversation = new URL(page.url()).search;
  await go(workspace);
  await go(`${workspace}${conversation}`);
  await shot("draft-restored");
  await page.route("**/api/v1/snapshot", (route) => route.abort());
  await page.getByRole("button", { name: "Päivitä", exact: true }).click();
  await page.getByText("Yhteys katkesi · tiedot voivat olla vanhoja").waitFor();
  await shot("outage");
  await page.unrouteAll();
  await ready();
  await page.getByRole("button", { name: "Tilivalikko" }).click();
  await shot("menu");
  await page.getByRole("menuitem", { name: "Teema: Tumma" }).click();
  await shot("theme-dark");
  await go(history);
  await shot("system-dark-history");
  await go("/settings");
  await shot("settings");
} finally {
  await fixture("scenario?value=ready").catch(() => {});
  await browser.close();
}
