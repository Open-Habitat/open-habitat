import { openLab, origin, snapshot } from "./session.mjs";

const { browser, page } = await openLab();
try {
  await page.goto(`${origin}/settings/recap`);
  const saved = page.waitForResponse(
    (r) =>
      r.request().method() === "PUT" &&
      r.url().endsWith("/api/v1/pi/recap-settings") &&
      r.status() === 200,
  );
  await page.getByTestId("recap-automatic").getByTestId("segment-off").click();
  await saved;
  await page.getByTestId("recap-off-warning").waitFor();
  await snapshot(page, "issues/recap-can-be-off/off");
} finally {
  await browser.close();
}
