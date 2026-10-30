// work-row-composer-gap-birch: the space between the live working row and
// the composer at a turn's start, in a short conversation at DSF 2.
// Synthetic lab only: node web/lab/measure-work-row-gap.mjs <lab-origin> <label> [workspace]
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const [
  origin,
  label = "run",
  workspace = "muistiinpanot",
  prompt = "hidas tehtävä",
] = process.argv.slice(2);
if (!/^https:\/\/127\.0\.0\.1:\d+$/.test(origin ?? ""))
  throw new Error(
    "usage: measure-work-row-gap.mjs https://127.0.0.1:<port> <label> [workspace]",
  );
const out = new URL(
  "../../issues/work-row-composer-gap-birch/evidence/",
  import.meta.url,
);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1550, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
});
const page = await context.newPage();
if ((await page.request.get(`${origin}/fixture/lab-marker`)).status() !== 204)
  throw new Error("not the synthetic lab");
await page.request.get(`${origin}/fixture/conversations-reset`);
await page.request.get(`${origin}/fixture/scenario?value=pi-deltas`);
await page.goto(`${origin}/workspaces`);
await page.getByTestId("github-sign-in").click();
await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
await page
  .getByRole("navigation")
  .getByTestId(`workspace-${workspace}`)
  .click();
await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
// Jari's state has no background-work strip; the lab's process service is
// absent, so its "?" chip would stand where his view has nothing.
await page.addStyleTag({ content: ".ah-bg-strip { display: none }" });
await page.getByTestId("message-input").fill(prompt);
await page.getByTestId("send").and(page.locator('[data-mode="send"]')).click();

const measure = () =>
  page.evaluate(() => {
    const stream = document.querySelector(".ah-conversation-stream");
    const composer = document.querySelector(".ah-composer");
    const field = document.querySelector('[data-testid="message-input"]');
    if (!stream || !composer) return null;
    const rows = [...stream.querySelectorAll(".ah-feed > li")].filter(
      (r) => r.getBoundingClientRect().height > 0,
    );
    const last = rows.at(-1);
    // The painted bottom of the last row: its deepest visible descendant.
    let ink = 0;
    for (const n of last?.querySelectorAll("*") ?? [])
      if (
        n.getClientRects().length &&
        getComputedStyle(n).visibility !== "hidden"
      )
        ink = Math.max(ink, n.getBoundingClientRect().bottom);
    const s = stream.getBoundingClientRect();
    const between = [...(stream.parentElement?.children ?? [])]
      .filter((c) => {
        const r = c.getBoundingClientRect();
        return (
          r.top >= s.bottom - 1 &&
          r.bottom <= composer.getBoundingClientRect().top + 1 &&
          r.height > 0
        );
      })
      .map(
        (c) =>
          `${c.className || c.tagName}:${c.getBoundingClientRect().height.toFixed(1)}`,
      );
    const cs = getComputedStyle(stream);
    return {
      rows: rows.length,
      lastKind: last?.dataset.kind ?? last?.className,
      lastText: (last?.textContent ?? "").replace(/\s+/g, " ").slice(0, 60),
      lastBox: last
        ? +(s.bottom - last.getBoundingClientRect().bottom).toFixed(1)
        : null,
      inkToStream: +(s.bottom - ink).toFixed(1),
      padBottom: Number.parseFloat(cs.paddingBottom),
      hold: Number.parseFloat(getComputedStyle(stream, "::after").height) || 0,
      streamToComposer: +(
        composer.getBoundingClientRect().top - s.bottom
      ).toFixed(1),
      composerPadTop: Number.parseFloat(getComputedStyle(composer).paddingTop),
      fieldTop: field
        ? +(field.getBoundingClientRect().top - ink).toFixed(1)
        : null,
      inkToComposer: +(composer.getBoundingClientRect().top - ink).toFixed(1),
      // To the field's drawn border, the edge a reader sees.
      inkToBorder: (() => {
        const box = [composer, ...composer.querySelectorAll("*")].find(
          (n) => Number.parseFloat(getComputedStyle(n).borderTopWidth) > 0,
        );
        return box ? +(box.getBoundingClientRect().top - ink).toFixed(1) : null;
      })(),
      between,
    };
  });

const samples = [];
const t0 = Date.now();
let shot = false;
while (Date.now() - t0 < 6000) {
  const m = await measure();
  if (m) samples.push({ t: Date.now() - t0, ...m });
  // The turn's start: the live row is up, the first reply not yet.
  if (!shot && Date.now() - t0 > 1200) {
    shot = true;
    const clip = await page.evaluate(() => {
      const c = document.querySelector(".ah-composer").getBoundingClientRect();
      const f = document.querySelector(".ah-feed").getBoundingClientRect();
      return {
        x: f.left - 40,
        y: c.bottom - 260,
        width: f.width + 80,
        height: 260,
      };
    });
    await page.screenshot({
      path: new URL(`${label}.png`, out).pathname,
      clip,
    });
  }
  await page.waitForTimeout(150);
}
const html = await page.evaluate(() => {
  const li = [...document.querySelectorAll(".ah-feed > li")].at(-1);
  const strip = document.querySelector(".ah-bg-strip");
  return {
    row: li?.outerHTML.slice(0, 4000),
    strip: strip?.outerHTML.slice(0, 3000),
  };
});
await writeFile(
  new URL(`${label}.json`, out),
  `${JSON.stringify({ origin, samples, lastRowHtml: html }, null, 2)}\n`,
);
for (const s of samples.filter((_, i) => i % 4 === 0))
  console.log(JSON.stringify(s));
await browser.close();
