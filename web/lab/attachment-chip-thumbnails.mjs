import { expect } from "@playwright/test";
import { openLab, snapshot } from "./session.mjs";

const { browser, page } = await openLab({ deviceScaleFactor: 2 });
try {
  await page
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi:/);
  const image = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#6495ad";
    ctx.fillRect(0, 0, 1200, 800);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(200, 100, 400, 500);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  const png = Buffer.from(image, "base64");
  await page.locator('.ah-composer input[type="file"]').setInputFiles(
    Array.from({ length: 5 }, (_, i) => ({
      name: `image-${i}.png`,
      mimeType: "image/png",
      buffer: png,
    })),
  );
  const chips = page.locator(".ah-composer").getByTestId("attachment-chip");
  await expect(chips).toHaveCount(5);
  await expect
    .poll(() =>
      chips
        .locator("img")
        .evaluateAll((images) =>
          images.every((img) => img.complete && img.naturalWidth > 0),
        ),
    )
    .toBe(true);
  await snapshot(
    page,
    "issues/attachment-chip-thumbnails/evidence/draft-chips",
  );
  await page
    .getByTestId("message-input")
    .fill("Five synthetic image attachments");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(chips).toHaveCount(0);
  await expect(
    page.locator('.ah-feed > li[data-kind="assistant"]'),
  ).toHaveCount(1);
  await snapshot(page, "issues/attachment-chip-thumbnails/evidence/sent-chips");
} catch (error) {
  console.error(await page.locator("body").innerText());
  throw error;
} finally {
  await browser.close();
}
