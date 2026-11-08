import { expect } from "@playwright/test";
import { openLab, snapshot } from "./session.mjs";

const stage = process.argv[2] ?? "after";
const { browser, page } = await openLab({ deviceScaleFactor: 2 });
try {
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/conversations", async (route) => {
    if (route.request().method() === "POST") await held;
    await route.continue();
  });
  await page.locator("nav").getByTestId("workspace-start-aurinkokello").click();
  await page.getByTestId("message-input").fill("Luonnos odottaa minua tässä.");
  await snapshot(
    page,
    `issues/new-conversation-rail-row/evidence/${stage}-pending`,
  );
  release();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  const id = new URL(page.url()).searchParams.get("conversation");
  const row = page.locator("nav").getByTestId(`agent-item-${id}`);
  await expect(row).toBeVisible();
  await row.hover();
  await snapshot(
    page,
    `issues/new-conversation-rail-row/evidence/${stage}-empty`,
  );
} finally {
  await browser.close();
}
