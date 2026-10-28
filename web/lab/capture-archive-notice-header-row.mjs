// Synthetic evidence for archive-notice-header-row; never uses live data.
// Run from the repository root with the lab started (scripts/lab.sh start).
import { chromium } from "@playwright/test";
import { origin, snapshot } from "./session.mjs";

const out = "issues/archive-notice-header-row/evidence";
const browser = await chromium.launch({ headless: true });
try {
  for (const [form, width, height] of [
    ["desk", 1440, 900],
    ["phone", 390, 844],
  ])
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        viewport: { width, height },
        deviceScaleFactor: 2,
        reducedMotion: "reduce",
      });
      await context.addInitScript((theme) => {
        localStorage.setItem("nah:theme", theme);
        document.documentElement.dataset.theme = theme;
      }, theme);
      const page = await context.newPage();
      const shot = (name) =>
        snapshot(page, `${out}/${form}-${theme}-${name}`, { html: false });
      await page.goto(`${origin}/workspaces`);
      await page.getByTestId("github-sign-in").click();
      await page.locator('a[href*="code=42"]').click();
      await page.goto(`${origin}/workspaces`);
      await page.locator("main").waitFor();
      const ws = await page
        .locator('a[href^="/workspaces/ws_"]')
        .first()
        .getAttribute("href");
      await page.goto(`${origin}${ws}`);
      const notice = page.getByTestId("archive-notice");
      // Desktop archives from the conversation's own header and lands on the
      // workspace page; the phone archives a card on that page.
      if (form === "desk") {
        await page.locator('main a:has-text("Avaa")').first().click();
        await page.getByTestId("archive-conversation").first().click();
        await page.waitForURL(/\/workspaces\/ws_[^?]*$/);
      } else {
        await page
          .locator("main")
          .getByTestId("archive-conversation")
          .first()
          .click();
      }
      await notice.getByTestId("restore-notice").waitFor();
      await page.mouse.move(0, height - 1);
      await shot("tyotilasivu");
      await page.getByTestId("workspace-archive").click();
      await page.getByTestId("notice-more").waitFor();
      await page.mouse.move(0, height - 1);
      await shot("pino");
      await page.getByTestId("notice-more").click();
      await shot("pino-auki");
      // Undo the workspace's archiving from its own row.
      await page
        .locator('[data-kind="workspace-archive"]')
        .getByTestId("restore-notice")
        .click();
      await page.getByTestId("notice-more").waitFor({ state: "detached" });
      await page.locator('main a:has-text("Avaa")').first().click();
      await page
        .getByTestId("message-input")
        .or(page.locator("main h1"))
        .first()
        .waitFor();
      await page.mouse.move(0, height - 1);
      await page.waitForTimeout(500);
      await shot("seuraava");
      await notice.getByTestId("restore-notice").click();
      await notice.waitFor({ state: "detached" });
      await context.close();
    }
} finally {
  await browser.close();
}
