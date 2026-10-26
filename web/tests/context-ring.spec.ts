import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.beforeEach(async ({ page }) => {
  expect((await page.request.get("/fixture/reset-clock")).status()).toBe(204);
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
});
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
});

async function send(page: import("@playwright/test").Page, text: string) {
  await page.getByTestId("message-input").fill(text);
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
}

// Fake Pi records usage with each reply as Pi does ("konteksti N" sets it) and
// compacts after a turn asked to ("tiivistä"); the window and reserve come
// from the fixture catalog through the real daemon history and event reads.
test("@context-ring the ring follows Pi's usage, compaction and reload", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const ring = page.locator(".ah-agent-header").getByTestId("context-ring");
  // Nothing to show before Pi's first reply.
  await expect(page.getByTestId("message-input")).toBeEnabled();
  await expect(ring).toHaveCount(0);
  const pill = page.locator(".md-empty-picker");
  await pill.locator(":scope > summary").click();
  await pill.getByTestId("model-gpt-6-nova").check();
  await pill.getByTestId(/^(model-commit|conversation-model-start)$/).click();
  await send(page, "konteksti 205300");
  await expect(ring).toHaveAttribute("data-tokens", "205300");
  await expect(ring).toHaveAttribute("data-window", "272000");
  await expect(ring).toHaveAttribute("data-level", "near");

  // Native history alone restores it.
  await page.reload();
  await expect(ring).toHaveAttribute("data-tokens", "205300");
  await expect(ring).toHaveAttribute("data-level", "near");

  // Details open as a dialog and give focus back to the ring.
  await ring.click();
  const dialog = page.getByTestId("context-dialog");
  await expect(dialog).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include(".ah-ctx-layer").analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(ring).toBeFocused();

  await send(page, "tiivistä konteksti 250000");
  await expect(ring).toHaveAttribute("data-level", "compacting");
  // After the compaction Pi's size is unknown until its next reply.
  await expect(ring).toHaveAttribute("data-level", "after");
  await page.reload();
  await expect(ring).toHaveAttribute("data-level", "after");
  await send(page, "jatka");
  await expect(ring).toHaveAttribute("data-tokens", "31600");
  await expect(ring).toHaveAttribute("data-level", "ok");

  // A phone shows the ring alone below the attention level, within the bar.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(ring).toBeVisible();
  await expect(ring.locator(".ah-ctx-value")).toBeHidden();
  const header = page.locator(".ah-agent-header");
  expect(
    await header.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  const box = await ring.boundingBox();
  expect(box && box.x + box.width).toBeLessThanOrEqual(390);
});
