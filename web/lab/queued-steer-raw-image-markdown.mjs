import { expect } from "@playwright/test";
import { openLab, snapshot } from "./session.mjs";

const { browser, page } = await openLab({
  deviceScaleFactor: 2,
  locale: "en-US",
});
try {
  await page
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const field = page.getByTestId("message-input");
  await field.fill("hidas main task");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(
    page.getByTestId("send").and(page.locator('[data-mode="steer"]')),
  ).toBeVisible();
  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("attach-file").click();
  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 120;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#dcebe6";
    ctx.fillRect(0, 0, 240, 120);
    ctx.fillStyle = "#294c43";
    ctx.font = "24px sans-serif";
    ctx.fillText("Synthetic image", 20, 65);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await (await chooser).setFiles({
    name: "screen.png",
    mimeType: "image/png",
    buffer: Buffer.from(image, "base64"),
  });
  await expect(
    page.locator(".ah-composer").getByTestId("attachment-chip"),
  ).toHaveCount(1);
  await field.fill("Test");
  // Hold delivery only for capture so the synthetic agent cannot consume the card.
  await page.route("**/api/v1/conversations/*/steer", () => {});
  await field.press("Enter");
  await expect(
    page.getByTestId("composer-queue").getByTestId("attachment-chip"),
  ).toHaveCount(1);
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  await snapshot(page, "../issues/queued-steer-raw-image-markdown/queue-dark", {
    region: '[data-testid="composer-queue"]',
  });
} finally {
  await browser.close();
}
