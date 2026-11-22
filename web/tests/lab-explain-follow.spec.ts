import type { Page } from "@playwright/test";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

// Selitystila with the experimental explain-follow switch on: the card
// travels beside the pointer and never takes it, only F pins it into its
// report, a click acts as always, and Esc lets go before it ends the mode.
// Through the real gateway and daemon with the synthetic Pi; cards are found
// by their part's id, never by wording.
test.use({
  baseURL: labOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1440, height: 900 },
});

async function signIn(page: Page) {
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const session = await (await page.request.get("/auth/session")).json();
  expect(
    (
      await page.request.put("/api/v1/account/preferences", {
        headers: {
          Origin: new URL(page.url()).origin,
          "X-Agent-Host-CSRF": session.csrf,
        },
        data: { experimental: { "explain-follow": true } },
      })
    ).ok(),
  ).toBe(true);
  await page.reload();
}

async function answered(page: Page) {
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  const ws = snapshot.workspaces.find(
    (w: { name: string }) => w.name === "aurinkokello",
  ).workspace_id;
  await page.goto(`/workspaces/${ws}`);
  await page.getByTestId("conversation-start").first().click();
  await expect(page.getByTestId("start-here")).toBeVisible();
  await page.getByTestId("message-input").fill("näytä kortit tiedosto");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(page.getByTestId("history-stage-toggle").last()).toBeVisible({
    timeout: 20000,
  });
}

const card = (page: Page) => page.getByTestId("explain-card");
const bar = (page: Page) => page.getByTestId("explain-bar");

async function box(page: Page) {
  const b = await card(page).boundingBox();
  if (!b) throw new Error("no card");
  return b;
}

async function centre(page: Page, testId: string) {
  const b = await page.getByTestId(testId).last().boundingBox();
  if (!b) throw new Error(`${testId} has no box`);
  return { x: b.x + Math.min(24, b.width / 2), y: b.y + b.height / 2 };
}

const under = (
  p: { x: number; y: number },
  b: { x: number; y: number; width: number; height: number },
) => p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;

test.describe("motion allowed", () => {
  test.use({ reducedMotion: "no-preference" });

  test("@lab @explain-follow the card follows beside the pointer, F alone pins it, and Esc lets go before it ends", async ({
    page,
  }) => {
    test.setTimeout(90000);
    await signIn(page);
    await answered(page);
    await page.getByTestId("explain-toggle").click();
    await expect(bar(page)).toBeVisible();

    // Beside the pointer, below right, with no report button to press.
    const ring = await centre(page, "context-ring");
    await page.mouse.move(ring.x, ring.y);
    await expect(card(page)).toHaveAttribute("data-card", "Y05");
    await expect(card(page)).toHaveAttribute("data-follow", "true");
    await expect(page.getByTestId("explain-report-key")).toBeVisible();
    await expect(page.getByTestId("explain-report")).toHaveCount(0);
    const input = await centre(page, "message-input");
    const p = { x: input.x + 200, y: input.y };
    await page.mouse.move(p.x, p.y);
    await expect(card(page)).toHaveAttribute("data-card", "V01");
    await expect
      .poll(async () => {
        const b = await box(page);
        return b.x > p.x && b.x - p.x < 40;
      })
      .toBe(true);
    // Near the bottom edge it goes above the pointer, never under it.
    const b0 = await box(page);
    expect(b0.y + b0.height).toBeLessThan(p.y);

    // Moving onto the card does not hold it: the card moves on, and what is
    // under the pointer explains itself.
    const onto = { x: b0.x + b0.width / 2, y: b0.y + b0.height / 2 };
    await page.mouse.move(onto.x, onto.y, { steps: 4 });
    await expect.poll(async () => under(onto, await box(page))).toBe(false);
    await expect(card(page)).not.toHaveAttribute("data-pinned", /.*/);

    // A click acts on the page as always and opens no report.
    const work = page.getByTestId("history-stage-toggle").last();
    const expanded = await work.getAttribute("aria-expanded");
    await work.click();
    await expect(work).not.toHaveAttribute("aria-expanded", expanded ?? "");
    await expect(page.getByTestId("explain-feedback-text")).toHaveCount(0);
    await expect(bar(page)).toBeVisible();

    // F pins the card and opens its report field, focused; the pinned card
    // stays put while the pointer goes elsewhere.
    await page.mouse.move(ring.x, ring.y);
    await expect(card(page)).toHaveAttribute("data-card", "Y05");
    await page.keyboard.press("f");
    const text = page.getByTestId("explain-feedback-text");
    await expect(text).toBeFocused();
    await expect(card(page)).toHaveAttribute("data-pinned", "true");
    await expect(page.getByTestId("explain-pinned")).toBeVisible();
    await page.keyboard.type("Korjattavaa");
    const pinned = await box(page);
    await page.mouse.move(input.x, input.y, { steps: 4 });
    await expect(card(page)).toHaveAttribute("data-card", "Y05");
    expect(await box(page)).toEqual(pinned);

    // The first Esc drops the typed text and lets go; the card follows
    // again. The second Esc ends the mode.
    await page.keyboard.press("Escape");
    await expect(text).toHaveCount(0);
    await expect(card(page)).not.toHaveAttribute("data-pinned", /.*/);
    await expect(bar(page)).toBeVisible();
    await page.mouse.move(p.x, p.y, { steps: 2 });
    await expect(card(page)).toHaveAttribute("data-card", "V01");
    await page.keyboard.press("Escape");
    await expect(bar(page)).toHaveCount(0);
  });

  test("@lab @explain-follow the keyboard explains the focused part and F pins it", async ({
    page,
  }) => {
    test.setTimeout(90000);
    await signIn(page);
    await answered(page);
    await page.getByTestId("explain-toggle").focus();
    await page.keyboard.press("Enter");
    await expect(bar(page)).toBeVisible();
    await page.getByTestId("context-ring").focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(card(page)).toHaveAttribute("data-card", "Y05");
    // Below the focused part.
    const ring = await page.getByTestId("context-ring").last().boundingBox();
    if (!ring) throw new Error("no ring");
    expect((await box(page)).y).toBeGreaterThan(ring.y + ring.height);
    await page.keyboard.press("f");
    await expect(page.getByTestId("explain-feedback-text")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("explain-feedback-text")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(bar(page)).toHaveCount(0);
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("@lab @explain-follow with less motion the card neither eases nor trails within a part", async ({
    page,
  }) => {
    test.setTimeout(90000);
    await signIn(page);
    await answered(page);
    await page.getByTestId("explain-toggle").click();
    await expect(bar(page)).toBeVisible();
    const input = await centre(page, "message-input");
    await page.mouse.move(input.x, input.y);
    await expect(card(page)).toHaveAttribute("data-card", "V01");
    expect(
      await card(page).evaluate(
        (el) => getComputedStyle(el).transitionDuration,
      ),
    ).toMatch(/^0s(, 0s)*$/);
    const first = await box(page);
    // Within the part, a move that keeps the pointer off the card leaves it.
    await page.mouse.move(input.x + 60, input.y, { steps: 3 });
    expect(await box(page)).toEqual(first);
    // Another part places it beside the pointer again.
    const ring = await centre(page, "context-ring");
    await page.mouse.move(ring.x, ring.y);
    await expect(card(page)).toHaveAttribute("data-card", "Y05");
    expect((await box(page)).y).not.toBe(first.y);
  });
});

test.describe("phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });

  test("@lab @explain-follow on a phone the card is a sheet whose report is a button", async ({
    page,
  }) => {
    test.setTimeout(90000);
    await signIn(page);
    await answered(page);
    await page.getByTestId("conversation-menu").tap();
    await page.getByTestId("menu-explain").tap();
    await expect(page.getByTestId("explain-state-card")).toBeVisible();
    await page.getByTestId("explain-close").tap();
    await expect(page.getByTestId("explain-state-card")).toHaveCount(0);
    const work = page.getByTestId("history-stage-toggle").last();
    await work.scrollIntoViewIfNeeded();
    await work.tap();
    await expect(card(page)).toHaveAttribute("data-card", "K04");
    await expect(card(page)).toHaveAttribute("data-touch", "true");
    // A sheet along an edge that leaves the tapped part in view.
    const sheet = await box(page);
    const part = await work.boundingBox();
    if (!part) throw new Error("no part");
    expect(sheet.x).toBe(8);
    expect(
      sheet.y + sheet.height <= part.y || sheet.y >= part.y + part.height,
    ).toBe(true);
    await expect(page.getByTestId("explain-report-key")).toHaveCount(0);
    await page.getByTestId("explain-report").tap();
    await expect(page.getByTestId("explain-feedback-text")).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
    ).toBe(false);
  });
});
