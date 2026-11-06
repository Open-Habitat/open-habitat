// Synthetic lab only. Today's conversation view (a new empty conversation and a
// running one) at 390 and 1440 px: DSF-2 screenshots of today into the issue's
// evidence/ (prefix r4-), and into ../../dist/ (not committed) the rendered page
// markup, the open ⋯ menu, the Git sheet, the model card, the context page and the
// production stylesheet, which build.mjs turns into the page.
// The lab dies with the shell that started it, so start it in the same command:
//   OH_PORT_BASE=6260 scripts/lab.sh start && OH_PORT_BASE=6260 PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
//     node design-system/prototypes/rounds/2026-11-06-alarivin-valikko/capture.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "../../../../web/node_modules/@playwright/test/index.mjs";
import { origin } from "../../../../web/lab/session.mjs";

const root = new URL("../../../../", import.meta.url).pathname;
const shots = `${root}issues/phone-header-second-row-uneven/evidence/`;
const cap = `${root}design-system/prototypes/dist/alarivin-valikko-capture/`;
mkdirSync(shots, { recursive: true });
mkdirSync(cap, { recursive: true });
const browser = await chromium.launch({ headless: true });
const fi = { light: "vaalea", dark: "tumma" };
// The top-level node an overlay was portalled into.
const portal = (sel) => {
  let el = document.querySelector(sel);
  if (!el) return "";
  while (el.parentElement && el.parentElement !== document.body) el = el.parentElement;
  return el.outerHTML;
};
const markup = (page) => page.evaluate(() => {
  for (const s of document.querySelectorAll("#root script")) s.remove();
  return document.querySelector("#root").outerHTML;
});
let wroteCss = false;
for (const situation of ["uusi", "kaynnissa"]) {
  for (const width of [390, 1440]) {
    for (const colorScheme of ["light", "dark"]) {
      const phone = width <= 800;
      const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        viewport: { width, height: phone ? 844 : 900 },
        deviceScaleFactor: 2,
        isMobile: phone,
        hasTouch: phone,
        colorScheme,
        locale: "fi-FI",
      });
      const page = await context.newPage();
      await page.goto(`${origin}/workspaces`);
      await page.getByTestId("github-sign-in").click();
      await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
      const state = await (await page.request.get(`${origin}/api/v1/snapshot`)).json();
      const ws = state.workspaces.find((w) => w.name === "aurinkokello");
      await page.goto(`${origin}/workspaces/${ws.workspace_id}`);
      await page.getByTestId(/^(new-conversation|conversation-start)$/).first().click();
      if (situation === "kaynnissa") {
        await page.getByTestId("message-input").fill("Tarkista puhelimen yläpalkki");
        await page.getByTestId("send").and(page.locator('[data-mode="send"]')).click();
        await page.locator(".ah-feed > li[data-kind=assistant]").first().waitFor();
      }
      await page.locator(".ah-conversation-frame > .ah-agent-header").waitFor();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: `${shots}r4-00-nyt-${situation}-${width}-${fi[colorScheme]}.png` });
      if (colorScheme !== "light") { await context.close(); continue; }
      const key = `${situation}-${width}`;
      writeFileSync(`${cap}${key}.html`, await markup(page));
      if (phone) {
        // Production's own places, as a phone opens them today.
        await page.getByTestId("conversation-menu").click();
        await page.getByRole("menu").waitFor();
        await page.waitForTimeout(400);
        writeFileSync(`${cap}menu-${key}.html`, await page.evaluate(portal, '[role="menu"]'));
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
        await page.locator(".ah-gs-chip").click();
        await page.locator(".ah-gs-sheet").waitFor();
        await page.waitForTimeout(500);
        writeFileSync(`${cap}git-${key}.html`, await page.evaluate(portal, ".ah-gs-sheet"));
        await page.screenshot({ path: `${shots}r4-00-nyt-${situation}-${width}-vaalea-git.png` });
        await page.keyboard.press("Escape");
        await page.waitForTimeout(400);
        const model = page.locator(".ah-agent-topline .md-chip-picker > summary");
        // Before the first message the model is the composer's, not the header's.
        if (await model.count()) {
          await model.click();
          await page.waitForTimeout(500);
          writeFileSync(`${cap}model-${key}.html`, await page.evaluate(() => document.querySelector(".ah-agent-topline .md-chip-picker").outerHTML));
          await model.click();
          await page.waitForTimeout(300);
        }
        if (await page.locator(".ah-ctx-chip").count()) {
          await page.locator(".ah-ctx-chip").click();
          await page.waitForTimeout(600);
          writeFileSync(`${cap}ctx-${key}.html`, await page.evaluate(() => document.querySelector(".ah-cd-page").outerHTML));
          await page.locator(".ah-ctx-chip").click();
          await page.waitForTimeout(300);
        }
      }
      if (!wroteCss) {
        const css = await page.evaluate(() =>
          [...document.styleSheets].map((s) => { try { return [...s.cssRules].map((r) => r.cssText).join("\n"); } catch { return ""; } }).join("\n"));
        writeFileSync(`${cap}production.css`, css);
        wroteCss = true;
      }
      await context.close();
    }
  }
}
await browser.close();
