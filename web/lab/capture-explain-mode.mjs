// Synthetic lab only: the explain mode's evidence for issues/explain-mode,
// at 1440 and 390, light and dark, device scale 2. Start the lab in the same
// shell first (scripts/lab.sh start), then from the repository root:
//   PLAYWRIGHT_BROWSERS_PATH=... node web/lab/capture-explain-mode.mjs
import { chromium } from "@playwright/test";
import { origin, snapshot } from "./session.mjs";

const out = new URL("../../issues/explain-mode/evidence/", import.meta.url)
  .pathname;
const browser = await chromium.launch({ headless: true });

async function open(width, theme) {
  const phone = width <= 800;
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width, height: phone ? 844 : 900 },
    deviceScaleFactor: 2,
    isMobile: phone,
    hasTouch: phone,
    colorScheme: theme,
    locale: "fi-FI",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(`${origin}/workspaces`);
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page.waitForURL(/\/workspaces/);
  const session = await (
    await page.request.get(`${origin}/auth/session`)
  ).json();
  await page.request.put(`${origin}/api/v1/account/preferences`, {
    headers: { Origin: origin, "X-Agent-Host-CSRF": session.csrf },
    data: { experimental: { "explain-mode": true } },
  });
  await page.reload();
  await page.waitForTimeout(800);
  return { context, page, phone };
}

async function conversation(page, prompt) {
  const state = await (
    await page.request.get(`${origin}/api/v1/snapshot`)
  ).json();
  const ws = state.workspaces.find(
    (w) => w.name === "aurinkokello",
  ).workspace_id;
  await page.goto(`${origin}/workspaces/${ws}`);
  await page.getByTestId("conversation-start").first().click();
  await page.getByTestId("start-here").waitFor();
  if (!prompt) return page.waitForTimeout(800);
  await page.getByTestId("message-input").fill(prompt);
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await page
    .getByTestId("history-stage-toggle")
    .last()
    .waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
}

const point = async (page, locator) => {
  const box = await locator.boundingBox();
  await page.mouse.move(
    box.x + Math.min(30, box.width / 2),
    box.y + box.height / 2,
  );
  await page.waitForTimeout(300);
};
const shot = (page, name, html) => snapshot(page, `${out}${name}`, { html });

for (const theme of ["light", "dark"]) {
  const tag = theme === "light" ? "vaalea" : "tumma";
  for (const width of [1440, 390]) {
    const { context, page, phone } = await open(width, theme);
    await page.request.get(`${origin}/fixture/conversations-reset`);
    const html = theme === "light";
    // The start page's strip.
    await conversation(page, "");
    await shot(page, `01-nauha-${width}-${tag}`, html && !phone);
    // A conversation: the mode opens at the state card.
    await conversation(
      page,
      "näytä kortit taustaprosessi virhekortti tiedosto kaavio",
    );
    if (phone) await page.getByTestId("explain-toggle").tap();
    else await page.getByTestId("explain-toggle").click();
    await page.waitForTimeout(500);
    await shot(page, `02-tilakortti-${width}-${tag}`, html);
    const work = page.getByTestId("history-stage-toggle").last();
    if (phone) {
      // The first tap explains; the card offers the action.
      await work.tap();
      await page.waitForTimeout(400);
      await shot(page, `03-napautus-kortti-${width}-${tag}`, html);
    } else {
      await point(page, work);
      await shot(page, `03-osoitus-kortti-${width}-${tag}`, html);
      if (theme === "light") {
        // Over empty space the card stays, quieter.
        const stream = await page
          .locator(".ah-conversation-stream")
          .boundingBox();
        await page.mouse.move(stream.x + 8, stream.y + 40);
        await page.waitForTimeout(300);
        await shot(page, `04-tyhja-kortti-jaa-${width}-${tag}`, false);
        // A press works and the mode stays: the work opens.
        await work.click();
        await page.waitForTimeout(500);
        await point(page, page.getByTestId("tool-row").first());
        await shot(page, `05-painallus-toimii-${width}-${tag}`, false);
        // Archiving waits.
        await page.getByTestId("archive-conversation").click();
        await page.waitForTimeout(300);
        await shot(page, `06-arkistoi-odottaa-${width}-${tag}`, false);
        // A rail row's hidden buttons wake and explain.
        const row = page.locator(".ah-rail [data-testid='agent-link']").first();
        await point(page, row);
        await point(
          page,
          page.getByTestId("rail-archive-conversation").first(),
        );
        await shot(page, `07-piilopainike-${width}-${tag}`, false);
        // The bar's state brings the state card back.
        await page.getByTestId("explain-state").click();
        await page.waitForTimeout(300);
        await shot(page, `08-palkin-tilanne-${width}-${tag}`, false);
        await page.keyboard.press("Escape");
        // Anywhere: the account menu's Selitä tämä näkymä.
        await page.goto(`${origin}/workspaces`);
        await page.waitForTimeout(800);
        await page.getByTestId("account-menu-trigger").click();
        await page.getByTestId("menu-explain").click();
        await point(
          page,
          page.locator('[data-testid^="conversation-card-"]').first(),
        );
        await shot(page, `10-etusivu-${width}-${tag}`, false);
        // In the mode an open menu's rows explain, above the menu.
        await page.getByTestId("account-menu-trigger").click();
        await point(page, page.getByTestId("menu-explain"));
        await shot(page, `09-tilivalikko-${width}-${tag}`, false);
        await page.keyboard.press("Escape");
        await page.keyboard.press("Escape");
        await page.goto(`${origin}/settings/experimental`);
        await page
          .getByTestId("experimental-explain-mode")
          .scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await shot(page, `11-asetus-${width}-${tag}`, false);
      }
    }
    await context.close();
  }
}
await browser.close();
console.log(`evidence in ${out}`);
