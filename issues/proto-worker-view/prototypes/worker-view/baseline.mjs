#!/usr/bin/env node
// Synthetic lab only: captures today's spinoff read-only view as the round's
// baseline and dumps the production conversation DOM and CSS to scratch, from
// which the prototype copies its markup. Run from the repository root with
// the lab started (scripts/lab.sh start).
//   node issues/proto-worker-view/prototypes/worker-view/baseline.mjs <scratch-dir>
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { openLab, origin } from "../../../../web/lab/session.mjs";

const scratch = process.argv[2];
if (!scratch) throw Error("usage: baseline.mjs <scratch-dir>");
const evidence = fileURLToPath(new URL("./evidence/", import.meta.url));
const now = Date.now();
const run = {
  run_id: "01m5aaaa0000bbbb1111cccc22",
  title: "Aikavyöhyketestit kellonäkymälle",
  state: "working",
  created_at: new Date(now - 420000).toISOString(),
  summary: "",
  preserved: false,
  branch: "wt/aikavyohyke",
  worktree: "/home/alice/src/aurinkokello__worktrees/wt-aikavyohyke",
  source_branch: "main",
};
const messages = [
  ["user", "Lisää kellonäkymälle testit aikavyöhykkeiden vaihtumiselle. Issue: `kello-dst`."],
  ["assistant", "Luen ensin nykyiset testit ja kellon muotoilun."],
  ["tool", "src/clock/format.ts"],
  ["tool", "npm test -- clock"],
  ["assistant", "Kesäajan vaihde puuttuu testeistä. Lisään kolme tapausta ja ajan testit uudelleen."],
];
const { browser, page } = await openLab();
try {
  await page.route("**/api/v1/agents/pi:*/spinoffs**", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        parent_id: new URL(route.request().url()).pathname.split("/agents/")[1].split("/spinoffs")[0],
        availability: "available",
        runs: [run],
        transcripts: [{
          node_id: "n-0001", availability: "available", truncated: false,
          messages: messages.map(([kind, text], i) => ({ key: `k${i}`, kind, text })),
        }],
      },
    }),
  );
  const nav = page.getByRole("navigation", { name: "Työtilat ja keskustelut" });
  const href = await nav.locator('a[href*="a1a1a1a1-0000-4000-8000-000000000001"]').first().getAttribute("href");
  if (!href) throw Error("Missing synthetic multi-group history");
  await page.goto(`${origin}${href}`);
  await page.locator(".ah-timeline").first().waitFor();
  await page.waitForTimeout(1500);
  const css = await page.evaluate(() =>
    [...document.styleSheets].map((s) => { try { return [...s.cssRules].map((r) => r.cssText).join("\n"); } catch { return ""; } }).join("\n"));
  await writeFile(`${scratch}/production.css`, css);
  await writeFile(`${scratch}/conversation.html`, await page.evaluate(() => document.body.outerHTML));
  await page.screenshot({ path: `${scratch}/conversation-1440.png` });
  // Expanded stages and tool rows show the markup of thinking and tool calls.
  for (const sel of ['[data-testid="history-stage-toggle"]', '[data-testid="history-tool-toggle"]', '[data-testid="thinking-toggle"]'])
    for (const b of await page.locator(`${sel}[aria-expanded="false"]`).all()) await b.click().catch(() => {});
  await page.waitForTimeout(500);
  await writeFile(`${scratch}/expanded.html`, await page.locator(".ah-conversation-frame").first().evaluate((e) => e.outerHTML));
  await page.screenshot({ path: `${scratch}/expanded-1440.png`, fullPage: true });
  // A live Pi conversation supplies the composer and the working strip.
  const ws = await nav.getByRole("link", { name: "aurinkokello", exact: true }).first().getAttribute("href");
  for (const f of ["scenario?value=ready", "conversations-reset", "lab-conversations-clean"])
    if ((await page.request.get(`${origin}/fixture/${f}`)).status() !== 204) throw Error(f);
  await page.goto(`${origin}/workspaces`);
  await page.goto(`${origin}${ws}`);
  await page.screenshot({ path: `${scratch}/workspace-1440.png` });
  await page.getByRole("button", { name: /Aloita uusi agenttikeskustelu|^Uusi keskustelu$/ }).first().click();
  await page.getByTestId("message-input").click();
  await page.keyboard.type("Näytä pitkä tuloste");
  await page.getByRole("button", { name: "Lähetä", exact: true }).click();
  await page.locator(".ah-turn-working").first().waitFor({ timeout: 15000 }).catch(() => {});
  await writeFile(`${scratch}/live.html`, await page.locator(".ah-conversation-frame").first().evaluate((e) => e.outerHTML));
  await page.screenshot({ path: `${scratch}/live-1440.png` });
  for (const [width, theme] of [[1440, "light"], [390, "dark"]]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${origin}${href}${href.includes("?") ? "&" : "?"}spinoff=${run.run_id}`);
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
    await page.locator(".ah-spinoff-view").waitFor();
    await page.waitForTimeout(500);
    if (width === 1440) await writeFile(`${scratch}/spinoff.html`, await page.evaluate(() => document.body.outerHTML));
    await page.screenshot({ path: `${evidence}/nykytila-${width}-${theme}.png` });
  }
} finally {
  await browser.close();
}
