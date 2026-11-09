// Synthetic lab evidence; run after scripts/lab.sh start.
import { expect } from "@playwright/test";
import { openLab, origin, snapshot } from "./session.mjs";

const out = new URL(
  "../../issues/attachment-total-checked-late/evidence/",
  import.meta.url,
).pathname;
for (const width of [1440, 390]) {
  for (const language of ["fi", "en-US"]) {
    const { browser, page } = await openLab({ width, deviceScaleFactor: 2 });
    try {
      const session = await (
        await page.request.get(`${origin}/auth/session`)
      ).json();
      for (const data of [
        { language },
        { experimental: { "explain-mode": true } },
      ]) {
        const saved = await page.request.put(
          `${origin}/api/v1/account/preferences`,
          {
            headers: { Origin: origin, "X-Agent-Host-CSRF": session.csrf },
            data,
          },
        );
        if (!saved.ok())
          throw new Error(
            `Preferences: ${saved.status()} ${await saved.text()}`,
          );
      }
      await page.reload();
      const state = await (
        await page.request.get(`${origin}/api/v1/snapshot`)
      ).json();
      const ws = state.workspaces.find(
        (w) => w.name === "aurinkokello",
      ).workspace_id;
      await page.goto(`${origin}/workspaces/${ws}`);
      await page.getByTestId("conversation-start").first().click();
      await page
        .getByTestId("message-input")
        .fill("Synthetic attachment selection");
      await page
        .locator('.ah-composer input[type="file"]')
        .evaluate((element) => {
          const data = new DataTransfer();
          for (let i = 0; i < 6; i++)
            data.items.add(
              new File(
                [new Uint8Array(20 * 1024 * 1024)],
                `sample-${i + 1}.bin`,
              ),
            );
          element.files = data.files;
          element.dispatchEvent(new Event("change", { bubbles: true }));
        });
      await expect(
        page.locator(".ah-composer [data-attachment-url]"),
      ).toHaveCount(5);
      await expect(page.getByTestId("attachment-overflow")).toBeVisible();
      await snapshot(page, `${out}overflow-${language}-${width}`);
      await page.getByTestId("explain-toggle").click();
      await page.getByTestId("message-input").hover();
      await expect(page.getByTestId("explain-state-card")).toHaveCount(0);
      const box = await page
        .getByTestId("attachment-overflow")
        .locator("strong")
        .boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await expect(
        page.locator(".ah-explain-card").filter({ hasText: "100" }),
      ).toBeVisible();
      await snapshot(page, `${out}explain-${language}-${width}`);
    } finally {
      await browser.close();
    }
  }
}
