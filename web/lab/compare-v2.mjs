#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
// Draft reference vs. synthetic host, never a live profile/server. Run from repo root.
// NAH_PORT_BASE=21000 PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" node web/lab/compare-v2.mjs
import { chromium } from "@playwright/test";
import { origin, snapshot } from "./session.mjs";

const root = resolve("issues/compare-v2-pairs");
const drafts = resolve("issues/review-browser-design-v2/design/vedokset");
const fontDir = resolve("design-system/fonts");
const fontCss = (
  await Promise.all(
    [
      ["Instrument Sans", "instrument-sans-latin.woff2"],
      ["JetBrains Mono", "jetbrains-mono-latin.woff2"],
    ].map(
      async ([family, filename]) =>
        `@font-face{font-family:'${family}';src:url(data:font/woff2;base64,${(await readFile(resolve(fontDir, filename))).toString("base64")}) format('woff2');font-weight:400 600}`,
    ),
  )
).join("\n");
const browser = await chromium.launch();
const draftContext = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  serviceWorkers: "block",
});
// CDN fonts are intentionally blocked; the draft uses the exact bundled UI fonts.
await draftContext.route("https://fonts.googleapis.com/**", (route) =>
  route.fulfill({ contentType: "text/css", body: fontCss }),
);
const reference = await draftContext.newPage();
const labContext = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
});
const lab = await labContext.newPage();
const desktop = [
  "paluu",
  "uusi",
  "hylatty",
  "tyo",
  "valmis",
  "katkos",
  "luku",
  "asetukset",
  "collapsed",
  "account-menu",
];
const phone = ["paluu", "drawer", "valmis", "tyo", "luku", "katkos"];
const modes = {
  paluu: "home",
  uusi: "new",
  hylatty: "rejected",
  tyo: "working",
  valmis: "completed",
  katkos: "disconnected",
  luku: "read-only",
  asetukset: "settings",
  drawer: "drawer",
  collapsed: "collapsed",
  "account-menu": "account-menu",
};
const fixture = async (path) => {
  const response = await lab.request.get(`${origin}/fixture/${path}`);
  if (response.status() !== 204)
    throw new Error(`fixture ${path}: ${response.status()}`);
};
async function labGo(path, theme, width) {
  await lab.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  await lab.goto(`${origin}${path}`);
  await lab.evaluate((t) => localStorage.setItem("nah:theme", t), theme);
  await lab.reload();
  await lab.locator("main").waitFor();
  await lab.waitForFunction(
    () =>
      document.documentElement.dataset.theme ===
        localStorage.getItem("nah:theme") &&
      !document.querySelector("main")?.textContent?.includes("Ladataan"),
  );
}
async function labShot(key) {
  await lab.evaluate(() => document.fonts.ready);
  if (await lab.getByRole("button", { name: "Kirjaudu GitHubilla" }).count())
    throw new Error(`${key}: lab session lost`);
  await snapshot(lab, `${root}/${key}-lab`);
  const htmlPath = `${root}/${key}-lab.html`;
  await writeFile(
    htmlPath,
    (await readFile(htmlPath, "utf8")).replace(/[ \t]+$/gm, ""),
  );
  // snapshot() supplies the offline HTML; compare the visible viewport, not the
  // full scroll document, against the designer's fixed-size reference frame.
  await lab.screenshot({
    path: `${root}/${key}-lab.png`,
    fullPage: false,
    animations: "disabled",
  });
  execFileSync(
    "avifenc",
    [
      "--min",
      "22",
      "--max",
      "32",
      "--speed",
      "7",
      `${root}/${key}-lab.png`,
      `${root}/${key}-lab.avif`,
    ],
    { stdio: "ignore" },
  );
  await rm(`${root}/${key}-lab.png`);
}
async function draftShot(file, mode, theme, width, key) {
  await reference.setViewportSize({
    width: width === 390 ? 1440 : 1500,
    height: 960,
  });
  await reference.goto(pathToFileURL(resolve(drafts, file)).href);
  await reference.waitForFunction(
    () =>
      typeof window.__dcSetProps === "function" &&
      !!document.querySelector("#dc-root [data-theme]"),
    { timeout: 30000 },
  );
  const name = await reference.evaluate(() => window.__dcRootName());
  await reference.evaluate(
    ({ name, theme }) => window.__dcSetProps(name, { theme }),
    { name, theme },
  );
  if (
    width === 1440 &&
    mode !== "paluu" &&
    mode !== "collapsed" &&
    mode !== "account-menu"
  ) {
    const label = {
      uusi: "Uusi keskustelu",
      hylatty: "Hylätty lähetys",
      tyo: "Työskentelee + jono",
      valmis: "Valmis vastaus",
      katkos: "Katkos + epävarma",
      luku: "Vain luku",
      asetukset: "Asetukset (välinäkymä 6)",
    }[mode];
    await reference
      .getByRole("button", { name: label, exact: true })
      .first()
      .click();
  }
  await reference.waitForFunction(
    (theme) =>
      document
        .querySelector("#dc-root [data-theme]")
        ?.getAttribute("data-theme") === theme,
    theme,
  );
  if (mode === "collapsed")
    await reference.getByRole("button", { name: "Piilota sivupalkki" }).click();
  if (mode === "account-menu")
    await reference.locator('#dc-root button[aria-haspopup="menu"]').click();
  await reference.evaluate(() => document.fonts.ready);
  const target =
    width === 390
      ? reference
          .locator('#dc-root [style*="width: 390px"][style*="height: 844px"]')
          .nth(phone.indexOf(mode))
      : reference
          .locator('#dc-root [style*="width: 1440px"][style*="height: 900px"]')
          .first();
  await target.waitFor();
  await target.screenshot({
    path: `${root}/${key}-draft.png`,
    animations: "disabled",
  });
  execFileSync(
    "avifenc",
    [
      "--min",
      "22",
      "--max",
      "32",
      "--speed",
      "7",
      `${root}/${key}-draft.png`,
      `${root}/${key}-draft.avif`,
    ],
    { stdio: "ignore" },
  );
  await rm(`${root}/${key}-draft.png`);
}
try {
  await mkdir(root, { recursive: true });
  await fixture("scenario?value=ready");
  await fixture("pi-state?value=usable");
  await lab.goto(`${origin}/workspaces`);
  await lab.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await lab.getByRole("link", { name: "Alice", exact: true }).click();
  const nav = lab.getByRole("navigation", { name: "Työtilat ja keskustelut" });
  const workspace = await nav
    .getByRole("link", { name: "aurinkokello", exact: true })
    .first()
    .getAttribute("href");
  const history = await nav
    .locator('a[href^="/agents/"]')
    .first()
    .getAttribute("href");
  if (!workspace || !history) throw new Error("Synthetic routes missing");
  // Capture unmutated home/settings/rail states before the fake Pi appends
  // conversation history; fixture conversations-reset only resets the controller.
  const jobs = [1440, 390]
    .flatMap((width) =>
      ["light", "dark"].flatMap((theme) =>
        (width === 390 ? phone : desktop).map((mode) => ({
          width,
          theme,
          mode,
        })),
      ),
    )
    .sort((a, b) => {
      const order = (mode) =>
        [
          "paluu",
          "drawer",
          "collapsed",
          "account-menu",
          "asetukset",
          "luku",
          "uusi",
          "hylatty",
          "tyo",
          "valmis",
          "katkos",
        ].indexOf(mode);
      return order(a.mode) - order(b.mode);
    });
  for (const { width, theme, mode } of process.argv.includes("--home")
    ? jobs.filter((j) => j.mode === "paluu")
    : process.argv.includes("--extras")
      ? jobs.filter(
          (j) =>
            ["collapsed", "account-menu"].includes(j.mode) ||
            (j.mode === "katkos" && j.width === 390),
        )
      : jobs) {
    await fixture("scenario?value=ready");
    await fixture("conversations-reset");
    let path =
      mode === "paluu" ||
      mode === "drawer" ||
      mode === "collapsed" ||
      mode === "account-menu"
        ? "/workspaces"
        : mode === "asetukset"
          ? "/settings"
          : history;
    if (["uusi", "hylatty", "tyo", "valmis", "katkos"].includes(mode))
      path = workspace;
    await labGo(path, theme, width);
    if (["uusi", "hylatty", "tyo", "valmis", "katkos"].includes(mode)) {
      await lab
        .getByRole("button", { name: "Aloita uusi Pi-keskustelu" })
        .click();
      const editor = lab.getByRole("textbox", { name: "Viesti Pi:lle" });
      await editor.waitFor();
      if (mode === "hylatty") {
        await editor.fill("hylkää");
        await lab.getByRole("button", { name: "Lähetä", exact: true }).click();
        await lab.getByText("Viesti hylättiin.", { exact: false }).waitFor();
      } else if (mode === "tyo" || mode === "valmis") {
        await editor.fill("hidas tarkistus");
        await lab.getByRole("button", { name: "Lähetä", exact: true }).click();
        if (mode === "tyo") {
          await lab.getByRole("button", { name: "Ohjaa" }).waitFor();
          await editor.fill("Aja lopuksi Lighthouse mobiiliprofiililla.");
          await lab
            .getByRole("button", { name: "Lähetä", exact: true })
            .click();
          await editor.fill("Älä muuta footerin rakennetta.");
          await lab.getByRole("button", { name: "Ohjaa" }).click();
          await lab.getByRole("button", { name: /Jonossa/ }).click();
          await lab
            .getByText("Älä muuta footerin rakennetta.", { exact: true })
            .waitFor();
        }
        await lab.getByText("Katson ensin, mitä työtilassa on.").waitFor();
        if (mode === "valmis")
          await lab
            .getByText(/Selvä. Kysyit:/)
            .last()
            .waitFor({ timeout: 30000 });
      } else if (mode === "katkos") {
        await editor.fill("Luonnos katkon aikana");
        await lab.route("**/api/v1/snapshot", (r) => r.abort());
        if (width === 390)
          await lab.evaluate(() => {
            window.dispatchEvent(new Event("blur"));
            window.dispatchEvent(new Event("focus"));
          });
        else
          await lab
            .getByRole("button", { name: "Päivitä", exact: true })
            .click();
        await lab
          .getByText("Yhteys katkesi · tiedot voivat olla vanhoja")
          .waitFor();
      }
    }
    if (mode === "drawer")
      await lab.getByRole("button", { name: "Avaa navigaatio" }).click();
    if (mode === "collapsed")
      await lab.getByRole("button", { name: "Sulje navigaatio" }).click();
    if (mode === "account-menu")
      await lab.getByRole("button", { name: "Tilivalikko" }).click();
    const key = `${modes[mode]}-${theme}-${width}`;
    if (mode === "tyo" && (await lab.getByText(/Selvä. Kysyit:/).count()))
      throw new Error(`${key}: fake Pi settled before working capture`);
    await labShot(key);
    await draftShot(
      width === 390 ? "Puhelin v2.dc.html" : "Selainpolku v2.dc.html",
      mode,
      theme,
      width,
      key,
    );
    await lab.unrouteAll();
    console.log(key);
  }
} finally {
  await lab.unrouteAll().catch(() => {});
  await fixture("scenario?value=ready").catch(() => {});
  await browser.close();
}
