// node check.mjs <offline.html> <evidence-directory>
// One Chromium, sequential pages. Measures, for each direction, how many
// conversation and workspace rows are fully visible in the bare app at
// 1280×720 and asserts that the direction's top line claims exactly that.
// Then walks 3 directions × fi/en × light/dark/contrast at 1280×720,
// 1920×1080 and 390×844: picker, the four places, popovers, palette (button
// and Ctrl+K), Escape, phone drawer, containment, offline, clean console;
// axe on the app at 1280 fi in every theme. Screenshots for human review only.

import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkPicker } from "../../picker-check.mjs";

const ROUND = "2026-11-22-ui-structure";
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(here, "../../../../web/package.json"));
const { chromium } = require("playwright");
const { default: AxeBuilder } = require("@axe-core/playwright");
const [input, out] = process.argv.slice(2);
if (!input || !out)
  throw new Error("usage: node check.mjs <offline.html> <evidence-directory>");
mkdirSync(out, { recursive: true });
const url = (q) => pathToFileURL(resolve(input)).href + "?" + q;
const browser = await chromium.launch();
const errors = [],
  requests = [];
async function open(width, height, q) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.route(/^https?:/, (r) => {
    requests.push(r.request().url());
    return r.abort();
  });
  await page.goto(url(q));
  await page.locator(".app[data-direction]").waitFor();
  await page.evaluate(() => document.fonts.ready);
  return { context, page };
}
const fully = (page, kind) =>
  page.evaluate((kind) => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      if (!el.getClientRects().length) return false;
      for (let p = el.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (/(auto|scroll|hidden)/.test(s.overflowY + s.overflowX)) {
          const q = p.getBoundingClientRect();
          if (
            r.top < q.top - 0.5 ||
            r.bottom > q.bottom + 0.5 ||
            r.left < q.left - 0.5 ||
            r.right > q.right + 0.5
          )
            return false;
        }
      }
      return (
        r.top >= 0 &&
        r.bottom <= innerHeight &&
        r.left >= 0 &&
        r.right <= innerWidth
      );
    };
    return [...document.querySelectorAll(`.app [data-count="${kind}"]`)].filter(
      vis,
    ).length;
  }, kind);
async function containment(page) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "page fits viewport",
  );
  const escaped = await page
    .locator(".app button, .app select, .app textarea")
    .evaluateAll((els) =>
      els
        .filter(
          (e) =>
            e.getClientRects().length && !e.closest(".ctabs,.scroll,.pills"),
        )
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return r.left < -1 || r.right > innerWidth + 1;
        })
        .map((e) => e.outerHTML.slice(0, 100)),
    );
  assert.deepEqual(escaped, [], "visible controls fit viewport");
}
const act = (page, a) =>
  page.locator(`[data-action="${a}"]`).filter({ visible: true }).first();
let cases = 0;
const measured = [];
try {
  // 1) Measure and compare against the top lines (fi and en carry the same numbers).
  for (let d = 0; d < 3; d++) {
    const { context, page } = await open(1280, 720, `v=${d + 1}&bare=1`);
    const conv = await fully(page, "conv"),
      ws = await fully(page, "ws");
    measured.push({ direction: d + 1, conv, ws });
    await context.close();
    for (const lang of ["fi", "en"]) {
      const { context: c2, page: p2 } = await open(
        1280,
        720,
        `v=${d + 1}&lang=${lang}`,
      );
      const line = await p2.locator(".review .line").innerText();
      const want =
        lang === "fi"
          ? `${conv} keskustelua + ${ws} työtilaa`
          : `${conv} conversations + ${ws} workspaces`;
      assert.ok(
        line.includes(want),
        `direction ${d + 1} ${lang}: top line must say "${want}", says: ${line}`,
      );
      await c2.close();
    }
  }
  // 2) Walk the matrix.
  for (const [width, height] of [
    [1280, 720],
    [1920, 1080],
    [390, 844],
  ])
    for (const theme of ["light", "dark", "contrast"])
      for (const lang of ["fi", "en"])
        for (let d = 0; d < 3; d++) {
          const phone = width < 700;
          const { context, page } = await open(
            width,
            height,
            `v=${d + 1}&theme=${theme}&lang=${lang}`,
          );
          await checkPicker(page, ROUND);
          await containment(page);
          assert.equal(
            await page.locator(`.app[data-direction="${d}"]`).count(),
            1,
          );
          assert.ok(
            await page.locator(".review .line").isVisible(),
            "top line visible on default view",
          );
          if (width === 1280 && lang === "fi") {
            const audit = await new AxeBuilder({ page })
              .include(".app")
              .analyze();
            assert.deepEqual(
              audit.violations.map(
                (v) => v.id + ": " + v.nodes.map((n) => n.target).join(" | "),
              ),
              [],
              `axe direction ${d + 1}`,
            );
          }
          const shot = `${out}/${d + 1}-${width}-${theme}-${lang}`;
          if (theme !== "contrast")
            await page.screenshot({ path: `${shot}.png` });
          // The four places: distinct icons, one treatment, none a card.
          // Phone: places live in the drawer in 1 and 3, in the top bar in 2.
          if (phone && d !== 1) await act(page, "drawer").click();
          const icons = await page.evaluate(() =>
            ["home", "outputs", "browser", "access"].map((k) => {
              const b = [
                ...document.querySelectorAll(`.app [data-action="dest:${k}"]`),
              ].find(
                (e) => e.getClientRects().length && !e.closest(".chips-above"),
              );
              return b
                ? (b.querySelector("svg")?.innerHTML ?? "logo") +
                    "|" +
                    b.className
                : null;
            }),
          );
          assert.ok(
            icons.every(Boolean),
            "every place reachable from navigation",
          );
          assert.equal(
            new Set(icons.map((i) => i.split("|")[0])).size,
            4,
            "four distinct icons",
          );
          assert.equal(
            new Set(icons.slice(1).map((i) => i.split("|")[1])).size,
            1,
            "outputs, browser and access share one treatment",
          );
          await act(page, "dest:outputs").click();
          assert.equal(await page.locator(".stub h2").count(), 1);
          await act(page, "open:ship").click();
          // Conversation actions menu, Escape closes it.
          await act(page, "pop:more").click();
          assert.equal(await page.locator(".more-pop").count(), 1);
          await page.keyboard.press("Escape");
          assert.equal(await page.locator(".pop").count(), 0);
          // Direction-specific structure.
          if (d === 0) {
            if (phone) await act(page, "drawer").click();
            await act(page, "scope:dye-lab").click();
            assert.equal(
              await page.locator(".column .conv-row").count(),
              3,
              "strip narrows the column to one workspace",
            );
            await act(page, "scope:all").click();
            if (phone) await page.keyboard.press("Escape");
          }
          if (d === 1) {
            await page.locator('[data-action="tab:editor"]').click();
            assert.equal(await page.locator(".pane-mock").count(), 1);
            await page.locator('[data-action="tab:chat"]').click();
          }
          if (d === 2) {
            if (phone) await act(page, "drawer").click();
            await act(page, "pop:inbox").click();
            assert.equal(await page.locator(".inbox-pop .conv-row").count(), 6);
            await page.locator('.inbox-pop [data-action="open:c5"]').click();
            assert.equal(
              await page.locator(".ws-row.selected .mono").innerText(),
              "ledger-tools",
              "opening from Attention switches home workspace",
            );
            await act(page, "pop:allconv").click();
            assert.equal(await page.locator(".allconv-pop").count(), 1);
            await page.keyboard.press("Escape");
          }
          // Palette from the button and from Ctrl+K.
          if (phone && d !== 1) await act(page, "drawer").click();
          await act(page, "palette").click();
          assert.ok(await page.locator("#palette").evaluate((e) => e.open));
          await page.keyboard.press("Escape");
          assert.ok(!(await page.locator("#palette").evaluate((e) => e.open)));
          if (phone && (await page.locator(".drawer-open").count()))
            await page.keyboard.press("Escape");
          await page.keyboard.press("Control+k");
          assert.ok(await page.locator("#palette").evaluate((e) => e.open));
          if (width === 1280 && theme === "light" && lang === "fi")
            await page.screenshot({ path: `${shot}-palette.png` });
          await page.locator('#palette [data-action="open:c1"]').click();
          assert.ok(!(await page.locator("#palette").evaluate((e) => e.open)));
          await containment(page);
          if (phone && theme === "light") {
            await act(page, "drawer").click();
            await page.screenshot({ path: `${shot}-drawer.png` });
            await page.mouse.click(width - 12, height / 2); // the scrim beside the drawer
            assert.equal(
              await page.locator(".drawer-open").count(),
              0,
              "scrim closes the drawer",
            );
          }
          // Picker wiring, not just query rendering.
          await page
            .locator(".proto-picker-item")
            .nth((d + 1) % 3)
            .click();
          await page.locator(`.app[data-direction="${(d + 1) % 3}"]`).waitFor();
          await checkPicker(page, ROUND);
          await containment(page);
          await context.close();
          cases++;
        }
  assert.deepEqual(errors, [], "clean console");
  assert.deepEqual(requests, [], "offline: no network requests");
  console.log(`MEASURED 1280×720 (bare): ${JSON.stringify(measured)}`);
  console.log(
    `PASS: ${cases} direction/language/theme/viewport cases. Screenshots: ${out}`,
  );
} finally {
  await browser.close();
}
