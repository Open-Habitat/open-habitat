// Synthetic lab only. Today's conversation view (a new empty conversation and a
// running one) at 390, 360 and 1440 px, light and dark: DSF-2 screenshots into the
// issue's kuvat/, and the rendered page markup, the open ⋯ menu and the production
// stylesheet into ../../dist/ (not committed), which build.mjs turns into the page.
// The lab dies with the shell that started it, so start it in the same command:
//   OH_PORT_BASE=5874 scripts/lab.sh start && PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
//     node design-system/prototypes/rounds/2026-11-03-otsakkeen-jako/capture.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "../../../../web/node_modules/@playwright/test/index.mjs";
import { origin } from "../../../../web/lab/session.mjs";

const root = new URL("../../../../", import.meta.url).pathname;
const shots = `${root}issues/phone-header-second-row-uneven/prototype-2/kuvat/`;
const cap = `${root}design-system/prototypes/dist/otsakkeen-jako-capture/`;
mkdirSync(shots, { recursive: true });
mkdirSync(cap, { recursive: true });
const browser = await chromium.launch({ headless: true });
const fi = { light: "vaalea", dark: "tumma" };
let wroteCss = false;
for (const situation of ["uusi", "kaynnissa"]) {
  for (const width of [390, 360, 1440]) {
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
      if (situation === "uusi" || (width === 390 && colorScheme === "light"))
        await page.screenshot({ path: `${shots}00-nyt-${situation}-${width}-${fi[colorScheme]}.png` });
      if (colorScheme !== "light" || width === 360) { await context.close(); continue; }
      const markup = await page.evaluate(() => {
        for (const s of document.querySelectorAll("#root script")) s.remove();
        return document.querySelector("#root").outerHTML;
      });
      writeFileSync(`${cap}${situation}-${width}.html`, markup);
      if (phone) {
        await page.getByTestId("conversation-menu").click();
        const menu = page.getByRole("menu");
        await menu.waitFor();
        await page.waitForTimeout(400);
        const popover = await page.evaluate(() => {
          const m = document.querySelector('[role="menu"]');
          let el = m;
          while (el.parentElement && el.parentElement !== document.body) el = el.parentElement;
          return el.outerHTML;
        });
        writeFileSync(`${cap}menu-${situation}-${width}.html`, popover);
        await page.screenshot({ path: `${cap}menu-${situation}-${width}.png` });
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
