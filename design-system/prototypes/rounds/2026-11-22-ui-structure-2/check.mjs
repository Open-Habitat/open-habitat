// node check.mjs <offline.html> <evidence-directory>
// One Chromium, sequential pages. Measures, for each direction, how many
// conversation and workspace rows are fully visible in the bare app at
// 1280×720 (direction 2 also with the navigator summoned) and asserts that
// the direction's review line claims exactly that. Then walks 3 directions ×
// fi/en × light/dark/contrast at 1280×720, 1920×1080 and 390×844: picker,
// the four places, the direction's own navigation, palette or navigator
// (button and Ctrl+K), Escape, phone drawer, containment, offline, clean
// console; axe on the app at 1280 fi in every theme, direction 2 also with
// the navigator open. Screenshots for human review only.

import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkPicker } from "../../picker-check.mjs";

const ROUND = "2026-11-22-ui-structure-2";
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
            e.getClientRects().length && !e.closest(".scroll"),
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
const say = (lang, conv, ws) =>
  lang === "fi"
    ? `${conv} keskustelua + ${ws} työtilaa`
    : `${conv} conversations + ${ws} workspaces`;
const navOpen = (page) => page.locator(".navigator").count();
async function axe(page, label) {
  const audit = await new AxeBuilder({ page }).include(".app").analyze();
  assert.deepEqual(
    audit.violations.map(
      (v) => v.id + ": " + v.nodes.map((n) => n.target).join(" | "),
    ),
    [],
    `axe ${label}`,
  );
}
try {
  // 1) Measure and compare against the review lines.
  for (let d = 0; d < 3; d++) {
    const { context, page } = await open(1280, 720, `v=${d + 1}&bare=1`);
    const m = {
      direction: d + 1,
      conv: await fully(page, "conv"),
      ws: await fully(page, "ws"),
    };
    if (d === 1) {
      await act(page, "nav").click();
      m.summoned = { conv: await fully(page, "conv"), ws: await fully(page, "ws") };
    }
    measured.push(m);
    await context.close();
    for (const lang of ["fi", "en"]) {
      const { context: c2, page: p2 } = await open(1280, 720, `v=${d + 1}&lang=${lang}`);
      const line = await p2.locator(".review .line").innerText();
      for (const want of [
        say(lang, m.conv, m.ws),
        ...(m.summoned ? [say(lang, m.summoned.conv, m.summoned.ws)] : []),
      ])
        assert.ok(line.includes(want), `direction ${d + 1} ${lang}: line must say "${want}", says: ${line}`);
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
          const { context, page } = await open(width, height, `v=${d + 1}&theme=${theme}&lang=${lang}`);
          const showNav = async () => {
            if (d === 1) {
              if (!(await navOpen(page))) await act(page, "nav").click();
            } else if (phone && !(await page.locator(".drawer-open").count()))
              await act(page, "drawer").click();
          };
          const hideNav = async () => {
            if ((d === 1 && (await navOpen(page))) || (await page.locator(".drawer-open").count()))
              await page.keyboard.press("Escape");
          };
          await checkPicker(page, ROUND);
          await containment(page);
          assert.equal(await page.locator(`.app[data-direction="${d}"]`).count(), 1);
          assert.ok(await page.locator(".review .line").isVisible(), "review line visible");
          if (width === 1280 && lang === "fi") await axe(page, `direction ${d + 1}`);
          const shot = `${out}/${d + 1}-${width}-${theme}-${lang}`;
          if (theme !== "contrast") await page.screenshot({ path: `${shot}.png` });
          // Direction 2 starts with no navigation at all.
          if (d === 1)
            assert.equal(await fully(page, "conv"), 0, "summoned: nothing permanent");
          // The four places: distinct icons, one treatment, none a card.
          await showNav();
          if (d === 1 && width === 1280 && lang === "fi") await axe(page, "direction 2 navigator");
          if (d === 1 && theme !== "contrast") await page.screenshot({ path: `${shot}-navigator.png` });
          const icons = await page.evaluate(() =>
            ["home", "outputs", "browser", "access"].map((k) => {
              const b = [...document.querySelectorAll(`.app [data-action="dest:${k}"]`)].find((e) => e.getClientRects().length);
              return b ? (b.querySelector("svg")?.innerHTML ?? "logo") + "|" + b.className : null;
            }),
          );
          assert.ok(icons.every(Boolean), `every place reachable: ${icons}`);
          assert.equal(new Set(icons.map((i) => i.split("|")[0])).size, 4, "four distinct icons");
          assert.equal(new Set(icons.slice(1).map((i) => i.split("|")[1])).size, 1, "outputs, browser, access share one treatment");
          await act(page, "dest:outputs").click();
          assert.equal(await page.locator(".stub h2").count(), 1);
          assert.equal(d === 1 ? await navOpen(page) : 0, 0, "choosing a place dismisses the navigator");
          await act(page, "open:ship").click();
          // Conversation actions menu, Escape closes it.
          await act(page, "pop:more").click();
          assert.equal(await page.locator(".more-pop").count(), 1);
          await page.keyboard.press("Escape");
          assert.equal(await page.locator(".pop").count(), 0);
          // Direction-specific navigation.
          if (d === 0) {
            await showNav();
            await act(page, "expand:dye-lab").click();
            assert.equal(await page.locator(".ws-kids .q-row").count(), 3, "workspace opens its quiet rows and page link in place");
            if (width === 1280 && theme === "light" && lang === "fi") await page.screenshot({ path: `${shot}-expanded.png` });
            await act(page, "expand:dye-lab").click();
            assert.equal(await page.locator(".ws-kids").count(), 0);
            await hideNav();
          }
          if (d === 1) {
            await showNav();
            assert.ok(await page.locator("#nav-input").evaluate((e) => e === document.activeElement), "navigator focuses its search");
            await page.keyboard.type(lang === "fi" ? "kassa" : "check");
            assert.equal(await page.locator(".navigator .q-row").count(), lang === "fi" ? 2 : 1, "navigator search filters");
            await page.keyboard.press("Escape");
            assert.equal(await navOpen(page), 0, "Escape dismisses the navigator");
            assert.ok(await page.locator('[data-action="nav"]').evaluate((e) => e === document.activeElement), "focus returns to the summon button");
            await act(page, "open:c1").click(); // Next
            assert.match(await page.locator(".conv-head h1").innerText(), /Kevään|Spring/);
            await act(page, "open:c2").click(); // Next again walks Your turn
            assert.match(await page.locator(".conv-head h1").innerText(), /Indigo/);
            await act(page, "nav").click();
            await act(page, "pin").click();
            assert.equal(await page.locator(".navigator.pinned").count(), 1, "pinned as a sidebar");
            if (!phone) {
              assert.equal(await page.locator(".scrim").count(), 0);
              if (theme !== "contrast" && lang === "fi") await page.screenshot({ path: `${shot}-pinned.png` });
            }
            await act(page, "pin").click();
            assert.equal(await navOpen(page), 0, "unpinned returns to quiet");
            await act(page, "nav").click();
            await page.locator('.navigator [data-action="open:ship"]').click();
          }
          if (d === 2) {
            await showNav();
            await act(page, "pop:wsfilter").click();
            assert.equal(await page.locator('[data-count="wsmenu"]').count(), 10, "filter menu names every workspace");
            await page.locator('[data-action="filter:dye-lab"]').click();
            assert.equal(await page.locator(".previews [data-count=conv]").count(), 3, "filter narrows the whole list");
            if (width === 1280 && theme === "light" && lang === "fi") await page.screenshot({ path: `${shot}-filtered.png` });
            await act(page, "filter:all").click();
            await hideNav();
          }
          // Palette (1, 3) or navigator (2) from the button and from Ctrl+K.
          if (d === 1) {
            await page.keyboard.press("Control+k");
            assert.equal(await navOpen(page), 1, "Ctrl+K summons the navigator");
            await page.locator('.navigator [data-action="open:c3"]').click();
            assert.equal(await navOpen(page), 0);
          } else {
            await showNav();
            await act(page, "palette").click();
            assert.ok(await page.locator("#palette").evaluate((e) => e.open));
            await page.keyboard.press("Escape");
            assert.ok(!(await page.locator("#palette").evaluate((e) => e.open)));
            await hideNav();
            await page.keyboard.press("Control+k");
            assert.ok(await page.locator("#palette").evaluate((e) => e.open));
            if (width === 1280 && theme === "light" && lang === "fi") await page.screenshot({ path: `${shot}-palette.png` });
            await page.locator('#palette [data-action="open:c1"]').click();
            assert.ok(!(await page.locator("#palette").evaluate((e) => e.open)));
          }
          await containment(page);
          if (phone && theme === "light") {
            await showNav();
            await page.screenshot({ path: `${shot}-drawer.png` });
            if (d !== 2) {
              await page.mouse.click(width - 8, height / 2); // the scrim beside the drawer
              assert.equal((await page.locator(".drawer-open").count()) + (await navOpen(page)), 0, "scrim closes the drawer");
            } else await page.keyboard.press("Escape");
          }
          // Picker wiring, not just query rendering.
          await page.locator(".proto-picker-item").nth((d + 1) % 3).click();
          await page.locator(`.app[data-direction="${(d + 1) % 3}"]`).waitFor();
          await checkPicker(page, ROUND);
          await containment(page);
          await context.close();
          cases++;
        }
  assert.deepEqual(errors, [], "clean console");
  assert.deepEqual(requests, [], "offline: no network requests");
  console.log(`MEASURED 1280×720 (bare): ${JSON.stringify(measured)}`);
  console.log(`PASS: ${cases} direction/language/theme/viewport cases. Screenshots: ${out}`);
} finally {
  await browser.close();
}
