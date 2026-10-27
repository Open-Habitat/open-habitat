// Synthetic lab only: phone-width conversation header screenshots.
// usage: node issues/phone-header-too-tall/shoot.mjs <before|after>
import { chromium } from "../../web/node_modules/@playwright/test/index.mjs";
import { origin } from "../../web/lab/session.mjs";

const label = process.argv[2] ?? "shot";
const out = new URL("./shots/", import.meta.url).pathname;
const browser = await chromium.launch({ headless: true });
for (const width of (process.env.WIDTHS ?? "390,360").split(",").map(Number)) {
  for (const colorScheme of (process.env.SCHEMES ?? "light,dark").split(",")) {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      colorScheme,
    });
    const page = await context.newPage();
    await page.request.get(`${origin}/fixture/open-at-end`);
    await page.goto(`${origin}/workspaces`);
    await page.getByTestId("github-sign-in").click();
    await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
    const state = await (await page.request.get(`${origin}/api/v1/snapshot`)).json();
    const ws = state.workspaces.find(
      (w) => w.name === (process.env.WORKSPACE ?? "aurinkokello"),
    );
    await page.goto(`${origin}/workspaces/${ws.workspace_id}`);
    await page.getByTestId(/^(new-conversation|conversation-start)$/).first().click();
    await page.getByTestId("message-input").fill("Tarkista puhelimen yläpalkki");
    await page.getByTestId("send").and(page.locator('[data-mode="send"]')).click();
    await page.locator(".ah-feed > li[data-kind=assistant]").first().waitFor();
    const header = page.locator(".ah-conversation-frame > .ah-agent-header");
    await header.waitFor();
    await page.waitForTimeout(1500);
    const box = await header.boundingBox();
    console.log(label, width, colorScheme, "header height", box.height);
    await page.screenshot({ path: `${out}${label}-${width}-${colorScheme}.png` });
    if (width > 800) { await context.close(); continue; }
    await page.getByTestId("conversation-menu").click();
    await page.getByRole("menu").waitFor();
    await page.screenshot({ path: `${out}${label}-${width}-${colorScheme}-menu.png` });
    await context.close();
  }
}
await browser.close();
