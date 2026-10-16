// Paired evidence for sending before Pi runs: the synthetic lab (real gateway,
// daemon controller and fake Pi) and prototype round 2026-10-16-jonolahetys
// direction 1 in the same states, desktop and phone, light and dark.
//
//   scripts/lab.sh start
//   node design-system/prototypes/build.mjs design-system/prototypes/rounds/2026-10-16-jonolahetys
//   PLAYWRIGHT_BROWSERS_PATH=... node issues/composer-and-new-conversation/capture.mjs
//
// Writes PNG + offline HTML (lab) and PNG (prototype) under shots/, then AVIF.
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openLab, origin, snapshot } from "../../web/lab/session.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, "shots");
const { chromium } = await import(
  join(here, "../../web/node_modules/playwright/index.mjs")
);
const prototype = resolve(
  here,
  "../../design-system/prototypes/dist/2026-10-16-jonolahetys.html",
);
const variants = [
  [1440, "light"],
  [1440, "dark"],
  [390, "light"],
  [390, "dark"],
];
const written = [];
const avif = (png) => {
  execFileSync("avifenc", ["-q", "60", "-s", "6", png, png.replace(/\.png$/, ".avif")], { stdio: "ignore" });
  rmSync(png);
  written.push(png.replace(/\.png$/, ".avif"));
};

async function lab(width, theme) {
  const { browser, page } = await openLab({ width, height: 900 });
  await page.emulateMedia({ colorScheme: theme });
  const editor = page.getByRole("textbox", { name: "Viesti Pi:lle" });
  const send = page.getByRole("button", { name: "Lähetä", exact: true });
  const scenario = (value) => page.request.get(`${origin}/fixture/scenario?value=${value}`);
  const shot = async (state) => {
    await page.waitForTimeout(300);
    const base = join(shots, `lab-${state}-${width}-${theme}`);
    await snapshot(page, base);
    avif(`${base}.png`);
  };
  const workspace = (
    await (await page.request.get(`${origin}/api/v1/snapshot`)).json()
  ).workspaces.find((w) => w.name === "aurinkokello");
  try {
    // 1. A new conversation while it is being created: two messages wait.
    await scenario("pi-slow-start");
    let release;
    const held = new Promise((r) => {
      release = r;
    });
    await page.route("**/api/v1/conversations", async (route) => {
      if (route.request().method() === "POST") await held;
      await route.continue();
    });
    await page.goto(`${origin}/workspaces/${workspace.workspace_id}`);
    await page.getByRole("button", { name: "Aloita uusi Pi-keskustelu", exact: true }).click();
    await editor.fill("Kerro lyhyesti, mitä tässä hakemistossa on.");
    await send.click();
    await editor.fill("Ehdota sitten README:n rakenne.");
    await send.click();
    await page.locator("[data-waiting]").nth(1).waitFor();
    await shot("new-waiting");
    release();
    await page.waitForURL(/conversation=pi:/);
    await page.getByText("Selvä. Kysyit:", { exact: false }).first().waitFor({ timeout: 30000 });
    // 2. After a daemon restart the conversation is writable history.
    await scenario("ready");
    await editor.fill("Aja testit ja korjaa, mitä löytyy.");
    await send.click();
    await page.getByText('Selvä. Kysyit: "Aja testit', { exact: false }).waitFor({ timeout: 30000 });
    await page.request.get(`${origin}/fixture/daemon-restart`);
    await page.reload();
    await editor.waitFor();
    await page.waitForFunction(() => !document.querySelector("textarea")?.disabled);
    await shot("stopped");
    // 3. A message sent to the stopped conversation waits while Pi starts.
    await scenario("pi-slow-start");
    await editor.fill("Lisää samalla README:hen esimerkki `--today`-lipusta.");
    await send.click();
    await page.locator("[data-waiting]").first().waitFor();
    await shot("stopped-waiting");
    // 4. Stop before Pi runs returns it to the field.
    await page.getByRole("button", { name: "Pysäytä: viesti ei lähde" }).click();
    await page.getByText("Viesti ei lähtenyt. Se on taas kentässä.").waitFor();
    await shot("stop-returned");
    // 5. A start that fails keeps the message with retry and edit.
    await page.waitForFunction(async () => {
      const id = new URL(location.href).searchParams.get("conversation");
      const r = await fetch(`/api/v1/conversations/${id.slice(3)}/status`);
      return (await r.json()).state === "stopped";
    }, undefined, { timeout: 30000, polling: 500 });
    await scenario("pi-start-fail");
    await send.click();
    await page.getByText("Pi ei käynnistynyt.").waitFor({ timeout: 20000 });
    await shot("failed");
  } finally {
    await scenario("ready");
    await browser.close();
  }
}

async function proto(width, theme) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
  await page.goto(`file://${prototype}`);
  await page.selectOption("#theme", theme);
  if (width < 1000) await page.check("#phone");
  await page.keyboard.press("1");
  const frame = page.locator(".frame");
  const shot = async (state) => {
    await page.waitForTimeout(300);
    const png = join(shots, `proto-${state}-${width}-${theme}.png`);
    await frame.screenshot({ path: png });
    avif(png);
  };
  const remount = async (entry, fail = false) => {
    await page.selectOption("#q-entry", entry);
    if ((await page.isChecked("#q-fail")) !== fail) await page.click("#q-fail");
    await page.waitForTimeout(600);
    await page.locator(".turn.live:not(.working)").last().waitFor({ timeout: 90000 }).catch(() => {});
  };
  const send = (text) => page.evaluate((t) => window.QDEMO.send(t), text);
  try {
    await remount("new");
    await send("Kerro lyhyesti, mitä tässä hakemistossa on.");
    await send("Ehdota sitten README:n rakenne.");
    await shot("new-waiting");
    await remount("stopped");
    await shot("stopped");
    await send("Lisää samalla README:hen esimerkki `--today`-lipusta.");
    await shot("stopped-waiting");
    await page.click('[data-q="stop"]');
    await shot("stop-returned");
    await remount("stopped", true);
    await send("Lisää samalla README:hen esimerkki `--today`-lipusta.");
    await page.locator(".q-failed").first().waitFor({ timeout: 20000 });
    await shot("failed");
  } finally {
    await browser.close();
  }
}

for (const [width, theme] of variants) {
  await lab(width, theme);
  await proto(width, theme);
}
console.log(JSON.stringify({ written: written.length }, null, 2));
