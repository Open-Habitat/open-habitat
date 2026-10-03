#!/usr/bin/env node
// Synthetic host only; fixture scenario is process-wide. Run without parallel browsers.
import { execFileSync } from "node:child_process";
import { request } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { openLab, origin, snapshot } from "./session.mjs";

const output = resolve(process.argv[2] || ".cache/lab/inventory");
const onlyState = process.argv[3];
if (!output.startsWith(`${resolve(".cache/lab")}/`))
  throw new Error("Output must be under .cache/lab/");
const inventory = JSON.parse(
  await readFile(new URL("./inventory.json", import.meta.url)),
);
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
await mkdir(output, { recursive: true });
const index = {
  commit,
  inventory: "web/lab/inventory.json",
  captured: [],
  missing: [],
};
let session;
async function fixture(page, path) {
  const response = await page.request.get(`${origin}/fixture/${path}`);
  if (response.status() !== 204)
    throw new Error(`fixture ${path}: HTTP ${response.status()}`);
}
async function login(page) {
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
}
try {
  // The lab's fixture switch is process-wide; a previous interrupted run may
  // have left it on onboarding or a transport fault.
  const reset = await request.newContext({ ignoreHTTPSErrors: true });
  try {
    const marker = await reset.get(`${origin}/fixture/lab-marker`);
    if (marker.status() !== 204) throw new Error("Not a synthetic lab");
    const response = await reset.get(`${origin}/fixture/scenario?value=ready`);
    if (response.status() !== 204) throw new Error("Cannot reset lab scenario");
  } finally {
    await reset.dispose();
  }
  session = await openLab();
  const { page } = session;
  page.setDefaultTimeout(8000);
  // Resolve native synthetic identifiers rather than embedding a fixture-specific ID.
  const workspace = await page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .getByRole("link", { name: "aurinkokello", exact: true })
    .first()
    .getAttribute("href");
  const history = await page
    .getByRole("navigation", { name: "Työtilat ja keskustelut" })
    .locator('a[href^="/agents/"]')
    .first()
    .getAttribute("href");
  if (!workspace || !history) throw new Error("Synthetic routes unavailable");
  for (const state of inventory.states.filter(
    (s) => !onlyState || s.id === onlyState,
  ))
    for (const presentation of inventory.presentations) {
      const key = `${state.id}-${presentation.id}`;
      if (state.status !== "capture") {
        index.missing.push({
          key,
          reason: state.reason || "No lab reproduction",
        });
        continue;
      }
      try {
        await fixture(page, `scenario?value=${state.scenario}`);
        await fixture(page, "pi-state?value=missing");
        await fixture(page, "conversations-reset");
        await page.context().clearCookies();
        await page.setViewportSize({
          width: presentation.width,
          height: presentation.height,
        });
        await page.goto(`${origin}/workspaces`);
        await page.evaluate(
          (theme) => localStorage.setItem("nah:theme", theme),
          presentation.theme,
        );
        await page.reload();
        for (const step of state.steps) {
          if (step === "login") {
            await login(page);
            if (state.route !== "/workspaces") {
              const route =
                state.route === "@workspace"
                  ? workspace
                  : state.route === "@history"
                    ? history
                    : state.route;
              await page.goto(`${origin}${route}`);
              await page.locator("main").waitFor();
            }
          } else if (step === "repo-chooser") {
            await page.getByRole("checkbox").first().check();
            await page.getByRole("button", { name: /jatka/i }).click();
          } else if (step === "start-sign-in")
            await page
              .getByRole("button", { name: "Aloita kirjautuminen" })
              .click();
          else if (step === "new-conversation")
            await page
              .getByRole("button", { name: "Aloita uusi Pi-keskustelu" })
              .click();
          else if (step === "send-rejected" || step === "send-uncertain") {
            await page
              .getByRole("textbox", { name: "Viesti Pi:lle" })
              .fill(step === "send-rejected" ? "hylkää" : "kaadu nyt");
            await page
              .getByRole("button", { name: "Lähetä", exact: true })
              .click();
            await page
              .getByText(
                step === "send-rejected" ? /Viesti hylättiin/ : "Tila epävarma",
              )
              .waitFor();
          } else if (step === "outage") {
            await page.route("**/api/v1/snapshot", (route) => route.abort());
            await page
              .getByRole("button", { name: "Päivitä", exact: true })
              .click();
            await page
              .getByText("Yhteys katkesi · tiedot voivat olla vanhoja")
              .waitFor();
            await page.unrouteAll();
          } else if (step === "account-menu")
            await page.getByRole("button", { name: "Tilivalikko" }).click();
          else if (step === "workspace-details")
            await page.locator(".ah-workspace-facts summary").click();
          else throw new Error(`Unknown step ${step}`);
        }
        await page.locator(state.region).first().waitFor();
        const actualTheme = await page.evaluate(
          () => document.documentElement.dataset.theme,
        );
        if (actualTheme !== presentation.theme)
          throw new Error(
            `Expected ${presentation.theme} theme; found ${actualTheme}`,
          );
        await page.evaluate(() => document.fonts.ready);
        const base = `${output}/${key}`;
        await snapshot(page, base, { region: state.region });
        if (state.focus) await snapshot(page, `${base}-full`);
        index.captured.push({
          key,
          state: state.id,
          presentation: presentation.id,
          html: `${key}.html`,
          screenshot: `${key}.png`,
          fullPage: state.focus ? `${key}-full.html` : null,
        });
      } catch (error) {
        index.missing.push({ key, reason: String(error).slice(0, 400) });
        await page.unrouteAll().catch(() => {});
      }
    }
} finally {
  await session?.browser.close();
  await writeFile(
    `${output}/index.json`,
    `${JSON.stringify(index, null, 2)}\n`,
  );
}
console.log(
  `${index.captured.length} captured, ${index.missing.length} missing; ${output}/index.json; commit ${commit}`,
);
if (
  index.missing.some(
    ({ key }) =>
      inventory.states.find((s) => key.startsWith(`${s.id}-`))?.status ===
      "capture",
  )
)
  process.exitCode = 1;
