#!/usr/bin/env node
// Paired screenshots and inert HTML of composer attachment chips, the preview
// dialog and a sent message's thumbnails, from the synthetic lab only.
import { openLab, snapshot } from "./session.mjs";

const out = new URL(
  "../../issues/composer-attachment-chip/review/",
  import.meta.url,
).pathname;

for (const [width, height] of [
  [1440, 900],
  [390, 844],
]) {
  const { browser, page } = await openLab({ width: 1440, height: 900 });
  try {
    // A lab conversation stands in for a screenshot to attach.
    await page
      .getByTestId("workspace-navigation")
      .getByText("Miksi CI epäonnistuu macOS:llä?")
      .first()
      .click();
    await page.getByTestId("agent-turn").first().waitFor();
    const screen = await page.screenshot();
    await page
      .getByTestId("workspace-navigation")
      .getByTestId("workspace-aurinkokello")
      .click();
    await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
    await page.setViewportSize({ width, height });
    const field = page.getByTestId("message-input");
    await field.fill("Mikä tässä näkymässä on vialla?");
    for (const file of [
      {
        name: "CleanShot 2026-10-24 at 08.53.52@2x.png",
        mimeType: "image/png",
        buffer: screen,
      },
      {
        name: "mittaukset-lokakuu.csv",
        mimeType: "text/csv",
        buffer: Buffer.from("päivä;arvo\n2026-10-01;12\n"),
      },
    ]) {
      const chooser = page.waitForEvent("filechooser");
      await page.getByTestId("attach-file").click();
      await page.getByTestId("attachment-single").click();
      await (await chooser).setFiles(file);
    }
    const chips = page.locator(".ah-composer").getByTestId("attachment-chip");
    await chips.nth(1).waitFor();
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".ah-composer img")].every(
        (img) => img.complete && img.naturalWidth > 0,
      ),
    );
    await page.waitForTimeout(300);
    await snapshot(page, `${out}composer-${width}`);
    await chips.first().getByTestId("attachment-open").click();
    await page.getByTestId("attachment-preview").locator("img").waitFor();
    await page.waitForTimeout(300);
    await snapshot(page, `${out}preview-image-${width}`);
    await page.keyboard.press("Escape");
    await chips.nth(1).getByTestId("attachment-open").click();
    await page.getByTestId("attachment-size").getByText(/t$/).waitFor();
    await snapshot(page, `${out}preview-file-${width}`);
    await page.keyboard.press("Escape");
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    await page
      .locator(".ah-user-content")
      .getByTestId("attachment-chip")
      .first()
      .waitFor();
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".ah-user-content img")].every(
        (img) => img.complete && img.naturalWidth > 0,
      ),
    );
    await page.waitForTimeout(300);
    await snapshot(page, `${out}sent-${width}`);
  } finally {
    await browser.close();
  }
}
