import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { createHostTest, expect } from "./worker-host";

const capture = process.env.OH_VISUAL_CAPTURE === "1";
const test = createHostTest(false, capture ? { BROWSER_HOST_LAB: "1" } : {});

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
    .getByTestId(capture ? "workspace-aurinkokello" : "workspace-ordinary-dir")
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

  // The ring opens the context page over the conversation: Pi's reading of
  // the same native session, through the real daemon and Pi's own functions.
  await ring.click();
  const contextPage = page.getByTestId("context-page");
  await expect(contextPage).toHaveAttribute("data-state", "ready");
  await expect(page).toHaveURL(/[?&]context=1/);
  // The page's measurement is the ring's: Pi's last recorded usage.
  await expect(page.getByTestId("context-total")).toHaveAttribute(
    "data-measured",
    "205300",
  );
  await expect(contextPage.getByRole("heading", { level: 2 })).toBeFocused();
  await expect(page.getByTestId("conversation-stream")).toBeHidden();
  await expect(ring).toHaveAttribute("aria-pressed", "true");
  expect(
    (await new AxeBuilder({ page }).include(".ah-cd-page").analyze())
      .violations,
  ).toEqual([]);
  // One turn so far, measured; Pi recorded its prompt and tools.
  await expect(
    page.getByTestId("context-turns").locator("tbody tr"),
  ).toHaveCount(1);
  await expect(
    page.getByTestId("context-parts").locator('tr.cat[data-k="sys"]'),
  ).toHaveCount(1);
  // A reload keeps the page; Escape returns to the conversation and the ring.
  await page.reload();
  await expect(contextPage).toHaveAttribute("data-state", "ready");
  await page.keyboard.press("Escape");
  await expect(contextPage).toHaveCount(0);
  await expect(page).not.toHaveURL(/context=1/);
  await expect(page.getByTestId("conversation-stream")).toBeVisible();
  await expect(ring).toBeFocused();

  await send(page, "tiivistä konteksti 250000");
  await expect(ring).toHaveAttribute("data-level", "compacting");
  // Hold the browser's running observation while measuring both layouts;
  // Pi may finish meanwhile, but cannot replace the row until reconnect.
  await page.context().setOffline(true);
  const holdUpdates = (route: import("@playwright/test").Route) =>
    /\/(events|snapshot|history|status)([/?]|$)/.test(route.request().url())
      ? route.abort()
      : route.continue();
  await page.route("**/api/**", holdUpdates);
  await page.context().setOffline(false);
  try {
    const notice = page.getByTestId("compaction-notice");
    await expect(notice).toHaveAttribute("data-state", "running");
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await notice.scrollIntoViewIfNeeded();
      const neighbour = page
        .locator('.ah-feed > li[data-kind="assistant"]')
        .last();
      await expect(async () => {
        const row = await notice.boundingBox();
        const box = await neighbour.boundingBox();
        if (!row || !box) throw new Error("Missing conversation box");
        expect(Math.abs(row.x - box.x)).toBeLessThan(1);
        expect(Math.abs(row.width - box.width)).toBeLessThan(1);
        expect(row.x).toBeGreaterThan(0);
        expect(row.x + row.width).toBeLessThan(width);
      }).toPass({ timeout: 5000 });
      if (capture) {
        const { snapshot } = await import("../lab/session.mjs");
        await snapshot(
          page,
          `../issues/compaction-row-misaligned/evidence/running-${width}`,
          {
            labOrigin: new URL(page.url()).origin,
          },
        );
      }
    }
  } finally {
    await page.unroute("**/api/**", holdUpdates);
    await page.setViewportSize({ width: 1280, height: 720 });
  }
  // After the compaction Pi's size is unknown until its next reply.
  await expect(ring).toHaveAttribute("data-level", "after");
  await page.reload();
  await expect(ring).toHaveAttribute("data-level", "after");
  // Right after it the page has Pi's compaction entry and no measurement.
  await ring.click();
  await expect(contextPage).toHaveAttribute("data-state", "ready");
  await expect(
    page.getByTestId("context-compactions").locator(":scope > li"),
  ).toHaveCount(1);
  await expect(
    page.getByTestId("context-parts").locator('tr.cat[data-k="rest"]'),
  ).toHaveCount(0);
  // The back control returns to the conversation as well.
  await page.getByTestId("context-back").click();
  await expect(contextPage).toHaveCount(0);
  await send(page, "jatka");
  await expect(ring).toHaveAttribute("data-tokens", "31600");
  await expect(ring).toHaveAttribute("data-level", "ok");

  // A phone carries the ring in the facts line, not a second row of chips.
  await page.setViewportSize({ width: 390, height: 844 });
  const phoneRing = page
    .getByTestId("phone-header-facts")
    .locator(".ah-ctx-ring");
  await expect(phoneRing).toBeVisible();
  await expect(ring).toBeHidden();
  const header = page.locator(".ah-agent-header");
  expect(
    await header.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  const box = await phoneRing.boundingBox();
  expect(box && box.x + box.width).toBeLessThanOrEqual(390);
});
