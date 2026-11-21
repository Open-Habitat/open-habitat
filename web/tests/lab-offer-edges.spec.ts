import { join } from "node:path";
import { snapshot } from "../lab/session.mjs";
import { labWorkerHostPort } from "../test-ports.mjs";
import { createHostTest, expect } from "./worker-host";

const test = createHostTest(true, { BROWSER_HOST_VIEWS: "1" });
const port = labWorkerHostPort(Number(process.env.TEST_PARALLEL_INDEX ?? 0));
test.use({
  reducedMotion: "reduce",
  baseURL: `https://app.oh.localhost:${port}`,
  launchOptions: {
    args: [`--host-resolver-rules=MAP *.oh.localhost:443 127.0.0.1:${port}`],
  },
});

test("timeline view and file offers share reply edges", async ({ page }) => {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-aurinkokello")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi:/);
  const id = new URL(page.url()).searchParams.get("conversation") ?? "";
  await page.getByTestId("message-input").fill("Check the sample.");
  await page.getByTestId("send").click();
  const reply = page.locator(".ah-turn-reply > .ah-message").last();
  await expect(reply).toBeVisible();
  await expect(page.getByTestId("send")).toHaveAttribute("data-mode", "send");
  const files = await page.request.get(
    `/fixture/files?target=${encodeURIComponent(id)}&set=types`,
  );
  expect(files.ok()).toBe(true);
  const { offer_ids: ids } = await files.json();
  const file = page.locator(
    `[data-testid="file-offer"][data-offer-id="${ids[3]}"]`,
  );
  await expect(file).toHaveAttribute("data-state", "ready");
  const viewResponse = await page.request.get(
    `/fixture/view?target=${encodeURIComponent(id)}`,
  );
  expect(viewResponse.ok()).toBe(true);
  const view = page.getByTestId("view-offer");
  await expect(view).toBeVisible();
  for (const width of [390, 800, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["light", "dark"]) {
      await page
        .locator("html")
        .evaluate(
          (html, value) => html.setAttribute("data-theme", value),
          theme,
        );
      await page.mouse.move(0, 0);
      for (const card of [file, view]) {
        await card.scrollIntoViewIfNeeded();
        const box = await card.boundingBox();
        const replyBox = await reply.boundingBox();
        if (!box || !replyBox)
          throw new Error("Missing conversation card bounds");
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
        expect(Math.abs(box.x - replyBox.x)).toBeLessThanOrEqual(1);
        expect(
          Math.abs(box.x + box.width - replyBox.x - replyBox.width),
        ).toBeLessThanOrEqual(1);
        const inset = await card.evaluate((element) => {
          const chevron = element.querySelector(".ah-offer-chev");
          if (!chevron) throw new Error("Missing chevron");
          const style = getComputedStyle(element);
          return (
            element.getBoundingClientRect().right -
            chevron.getBoundingClientRect().right -
            Number.parseFloat(style.paddingRight) -
            Number.parseFloat(style.borderRightWidth)
          );
        });
        expect(Math.abs(inset)).toBeLessThanOrEqual(1);
      }
      const evidence = process.env.OH_OFFER_EDGES_EVIDENCE;
      if (evidence && [390, 1920].includes(width)) {
        // The types fixture deliberately includes unsupported image previews.
        await page.locator("img").evaluateAll((images) =>
          images
            .filter(
              (image) =>
                image instanceof HTMLImageElement && !image.naturalWidth,
            )
            .forEach((image) => {
              image.remove();
            }),
        );
        await snapshot(page, join(evidence, `offers-${width}-${theme}`), {
          labOrigin: new URL(page.url()).origin,
        });
      }
    }
  }
});
