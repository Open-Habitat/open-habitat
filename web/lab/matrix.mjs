#!/usr/bin/env node
// Synthetic lab survey; isolated context, fixture state is process-wide. Run alone.
// PLAYWRIGHT_BROWSERS_PATH=... node web/lab/matrix.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { origin } from "./session.mjs";

const out = resolve(".cache/lab/shots");
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
const results = [];
const cases = [
  "ready",
  "empty",
  "missing",
  "error",
  "partial",
  "malformed",
  "oversize",
  "foreign",
  "delay",
  "native-error",
  "pi-blocked",
  "pi-onboarding",
];
const variants = [
  ["light", 1440],
  ["dark", 1440],
  ["light", 390],
  ["dark", 390],
];
async function fixture(path) {
  const response = await page.request.get(`${origin}/fixture/${path}`);
  if (response.status() !== 204)
    throw new Error(`fixture ${path}: HTTP ${response.status()}`);
}
async function visit(route, theme, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${origin}${route}`);
  await page.evaluate((choice) => {
    localStorage.setItem("nah:theme", choice);
  }, theme);
  await page.reload();
  await page.locator("main").waitFor({ timeout: 12000 });
  await page
    .waitForFunction(
      () => !document.querySelector("main")?.textContent?.includes("Ladataan"),
      null,
      { timeout: 2500 },
    )
    .catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  const state = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme,
    heading: document.querySelector("main h1")?.textContent?.trim() ?? "",
    text:
      document.querySelector("main")?.textContent?.trim().slice(0, 400) ?? "",
    login: !!document.querySelector(".ah-login-card"),
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2,
  }));
  if (state.theme !== theme || !state.heading || state.login)
    throw new Error(`invalid state ${JSON.stringify(state)}`);
  return state;
}
try {
  await fixture("scenario?value=ready");
  await page.goto(`${origin}/workspaces`);
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .waitFor();
  const history = await page
    .getByRole("navigation")
    .locator('a[href^="/agents/"]')
    .first()
    .getAttribute("href");
  const workspace = await page
    .getByRole("navigation")
    .getByRole("link", { name: "aurinkokello", exact: true })
    .first()
    .getAttribute("href");
  if (!history || !workspace) throw new Error("missing lab routes");
  const routes = { L: "/workspaces", H: history, C: workspace, S: "/settings" };
  if (!process.argv.includes("--flows"))
    for (const scenario of cases) {
      await fixture(`scenario?value=${scenario}`);
      if (scenario === "pi-onboarding") await fixture("pi-state?value=missing");
      for (const [theme, width] of variants) {
        for (const [routeKey, route] of Object.entries(routes)) {
          const key = `${scenario}-${routeKey}-${theme}-${width}`;
          try {
            const state = await visit(route, theme, width);
            await page.screenshot({
              path: `${out}/${key}.png`,
              fullPage: true,
            });
            results.push({
              scenario,
              route: routeKey,
              theme,
              width,
              ...state,
              status: "observed",
            });
          } catch (error) {
            results.push({
              scenario,
              route: routeKey,
              theme,
              width,
              status: "unverified",
              error: String(error),
            });
          }
        }
      }
      console.log(
        `${scenario}: ${results.filter((r) => r.scenario === scenario && r.status === "observed").length}/16 observed`,
      );
    }
  if (process.argv.includes("--flows")) {
    for (const [theme, width] of variants) {
      await fixture("scenario?value=ready");
      await fixture("conversations-reset");
      await visit(workspace, theme, width);
      await page
        .getByRole("button", { name: "Aloita uusi Pi-keskustelu" })
        .click();
      const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
      await editor.fill("hylkää");
      await page.getByRole("button", { name: "Lähetä", exact: true }).click();
      await page
        .getByText("Viesti hylättiin.", { exact: false })
        .waitFor({ timeout: 20000 });
      if ((await editor.inputValue()) !== "hylkää")
        throw new Error("rejected draft lost");
      await page.screenshot({
        path: `${out}/flow-rejected-${theme}-${width}.png`,
      });
      await editor.fill("kaadu nyt");
      await page.getByRole("button", { name: "Lähetä", exact: true }).click();
      await page.getByText("Tila epävarma").waitFor({ timeout: 20000 });
      if (
        await page
          .getByRole("button", { name: "Lähetä", exact: true })
          .isEnabled()
      )
        throw new Error("uncertain send enabled");
      await page.screenshot({
        path: `${out}/flow-uncertain-${theme}-${width}.png`,
      });
      results.push({
        scenario: "send",
        theme,
        width,
        status: "observed",
        route: "C",
      });
      await fixture("conversations-reset");
      await visit(workspace, theme, width);
      await page
        .getByRole("button", { name: "Aloita uusi Pi-keskustelu" })
        .click();
      const draft = page.getByRole("textbox", { name: "Viesti Pi:lle" });
      await draft.fill("Luonnos katkon aikana");
      await page.route("**/api/v1/snapshot", (route) => route.abort());
      if (width === 390)
        await page.getByRole("button", { name: "Avaa navigaatio" }).click();
      await page.getByRole("button", { name: "Päivitä", exact: true }).click();
      await page
        .getByText("Yhteys katkesi · tiedot voivat olla vanhoja")
        .waitFor();
      if (
        (await draft.inputValue()) !== "Luonnos katkon aikana" ||
        (await page
          .getByRole("button", { name: "Lähetä", exact: true })
          .isEnabled())
      )
        throw new Error("stale write enabled or draft lost");
      await page.screenshot({
        path: `${out}/flow-stale-${theme}-${width}.png`,
      });
      await page.unrouteAll();
      await page.getByRole("button", { name: "Yritä uudelleen" }).click();
      await page
        .getByText("Yhteys katkesi · tiedot voivat olla vanhoja")
        .waitFor({ state: "detached" });
      results.push({
        scenario: "stale-restored",
        theme,
        width,
        status: "observed",
        route: "C",
      });
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await page.request.get(`${origin}/fixture/expire`);
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      // Explicit user refresh also probes authority if the focus event raced an in-flight read.
      if (
        await page
          .getByRole("button", { name: "Päivitä", exact: true })
          .isVisible()
      )
        await page
          .getByRole("button", { name: "Päivitä", exact: true })
          .click();
      await page
        .getByRole("button", { name: "Kirjaudu GitHubilla" })
        .waitFor({ timeout: 12000 });
      if (await page.getByText("Luonnos katkon aikana").count())
        throw new Error("old identity visible after expiry");
      await page.screenshot({
        path: `${out}/flow-expired-${theme}-${width}.png`,
      });
      results.push({
        scenario: "expired",
        theme,
        width,
        status: "observed",
        route: "C",
      });
      await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
      await page.getByRole("link", { name: "Alice", exact: true }).click();
    }
    for (const scenario of ["pi-blocked", "pi-onboarding"]) {
      await fixture(`scenario?value=${scenario}`);
      await fixture("pi-state?value=missing");
      for (const [theme, width] of variants) {
        const state = await visit("/workspaces", theme, width);
        await page.screenshot({
          path: `${out}/flow-first-${scenario}-${theme}-${width}.png`,
        });
        results.push({
          scenario,
          theme,
          width,
          status: "observed",
          route: "F",
          ...state,
        });
      }
    }
  }
} finally {
  await fixture("pi-state?value=missing").catch(() => {});
  await fixture("scenario?value=ready").catch(() => {});
  await writeFile(
    resolve(
      process.argv.includes("--flows")
        ? ".cache/lab/flows.json"
        : ".cache/lab/matrix.json",
    ),
    JSON.stringify(results, null, 2),
  );
  await browser.close();
}
if (results.some((r) => r.status !== "observed")) process.exitCode = 1;
