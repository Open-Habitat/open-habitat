import type { Page } from "@playwright/test";
import { labOrigin } from "../test-ports.mjs";
import { expect, test } from "./lab-host";

// Selitystila (experimental, explain-mode): the screen dims and the part
// under the pointer explains itself, through the real gateway and daemon
// with the synthetic Pi. Cards are found by their part's id, never by
// wording.
test.use({
  baseURL: labOrigin,
  ignoreHTTPSErrors: true,
  reducedMotion: "reduce",
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
        data: { experimental: { "explain-mode": true } },
      })
    ).ok(),
  ).toBe(true);
  await page.reload();
}

async function newConversation(page: Page) {
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  const ws = snapshot.workspaces.find(
    (w: { name: string }) => w.name === "aurinkokello",
  ).workspace_id;
  await page.goto(`/workspaces/${ws}`);
  await page.getByTestId("conversation-start").first().click();
  await expect(page.getByTestId("start-here")).toBeVisible();
}

async function answered(page: Page) {
  await newConversation(page);
  await page
    .getByTestId("message-input")
    .fill("näytä kortit taustaprosessi virhekortti tiedosto kaavio");
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

async function pointAt(page: Page, testId: string) {
  const box = await page.getByTestId(testId).last().boundingBox();
  if (!box) throw new Error(`${testId} has no box`);
  await page.mouse.move(
    box.x + Math.min(24, box.width / 2),
    box.y + box.height / 2,
  );
}

test("@lab explain mode opens at the state card, explains what the pointer is on and lets presses work", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await answered(page);

  // Selitä opens the mode at the state card; the bar names the state.
  await page.getByTestId("explain-toggle").click();
  await expect(bar(page)).toBeVisible();
  const state = page.getByTestId("explain-state-card");
  await expect(state).toHaveAttribute("data-situation", "yourTurn");
  await expect(page.getByTestId("explain-state")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // A row of Voit nyt does what it names, and the mode stays.
  await expect(page.getByTestId("explain-can-K04")).toBeVisible();

  // Pointing at a part explains it and puts the state card away.
  await pointAt(page, "history-stage-toggle");
  await expect(card(page)).toHaveAttribute("data-card", "K04");
  await expect(state).toHaveCount(0);
  await expect(page.getByTestId("explain-state")).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  // Over empty space the card stays, quieter.
  const stream = await page.locator(".ah-conversation-stream").boundingBox();
  if (!stream) throw new Error("no conversation");
  await page.mouse.move(stream.x + 8, stream.y + 40);
  await expect(card(page)).toHaveAttribute("data-card", "K04");
  await expect(card(page)).toHaveClass(/ah-explain-linger/);

  // A press does what it always does, and the mode stays on.
  const work = page.getByTestId("history-stage-toggle").last();
  await work.click();
  await expect(work).toHaveAttribute("aria-expanded", "true");
  await expect(bar(page)).toBeVisible();
  await pointAt(page, "tool-row");
  await expect(card(page)).toHaveAttribute("data-card", /^K(0[5-9]|10)$/);

  // A lasting press waits: archiving does nothing in the mode.
  const url = page.url();
  await page.getByTestId("archive-conversation").click();
  await expect(card(page)).toHaveAttribute("data-card", "Y11");
  await expect(page.locator(".ah-explain-toast")).toBeVisible();
  expect(page.url()).toBe(url);
  await expect(page.getByTestId("archive-conversation")).toBeVisible();

  // The bar's state brings the state card back.
  await page.getByTestId("explain-state").click();
  await expect(state).toBeVisible();
  await expect(card(page)).toHaveCount(0);

  // A row's hidden buttons show under the pointer as always and explain.
  const row = page.locator(".ah-rail [data-testid='agent-link']").first();
  const rowBox = await row.boundingBox();
  if (!rowBox) throw new Error("no rail row");
  await page.mouse.move(rowBox.x + 30, rowBox.y + rowBox.height / 2);
  await expect(card(page)).toHaveAttribute("data-card", "S09");
  const archive = page.getByTestId("rail-archive-conversation").first();
  await expect(archive).toBeVisible();
  const archiveBox = await archive.boundingBox();
  if (!archiveBox) throw new Error("no rail archive");
  await page.mouse.move(
    archiveBox.x + archiveBox.width / 2,
    archiveBox.y + archiveBox.height / 2,
  );
  await expect(card(page)).toHaveAttribute("data-card", "S13");

  // Esc ends the mode; Selitä again ends it too.
  await page.keyboard.press("Escape");
  await expect(bar(page)).toHaveCount(0);
  await expect(page.locator(".ah-explain-layer")).toHaveCount(0);
  await page.getByTestId("explain-toggle").click();
  await expect(bar(page)).toBeVisible();
  await page.getByTestId("explain-toggle").click();
  await expect(bar(page)).toHaveCount(0);
});

test("@lab explain mode starts from the account menu anywhere and from the start page's strip", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await page.goto("/workspaces");
  await page.getByTestId("account-menu-trigger").click();
  await page.getByTestId("menu-explain").click();
  await expect(bar(page)).toBeVisible();
  // Outside a conversation there is no state to name.
  await expect(page.getByTestId("explain-state")).toHaveCount(0);
  await pointAt(page, "home-link");
  await expect(card(page)).toHaveAttribute("data-card", "S03");
  await page.getByTestId("explain-stop").click();
  await expect(bar(page)).toHaveCount(0);

  await newConversation(page);
  await page.getByTestId("explain-strip-go").click();
  await expect(page.getByTestId("explain-state-card")).toHaveAttribute(
    "data-situation",
    "notStarted",
  );
  await page.getByTestId("explain-strip-go").click();
  await expect(bar(page)).toHaveCount(0);
  // Closed, the strip stays closed in this browser.
  await page.getByTestId("explain-strip-close").click();
  await expect(page.getByTestId("explain-strip")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("start-here")).toBeVisible();
  await expect(page.getByTestId("explain-strip")).toHaveCount(0);
});

test.describe("phone", () => {
  test.use({ hasTouch: true, isMobile: true });

  test("@lab on a phone the first tap explains, a second does it, and ⋯ opens the mode", async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);
    await answered(page);

    await page.getByTestId("conversation-menu").tap();
    await page.getByTestId("menu-explain").tap();
    await expect(page.getByTestId("explain-state-card")).toBeVisible();

    const work = page.getByTestId("history-stage-toggle").last();
    await work.scrollIntoViewIfNeeded();
    await work.tap();
    await expect(card(page)).toHaveAttribute("data-card", "K04");
    await expect(card(page)).toHaveAttribute("data-touch", "true");
    await expect(work).toHaveAttribute("aria-expanded", "false");
    await work.tap();
    await expect(work).toHaveAttribute("aria-expanded", "true");
    await expect(bar(page)).toBeVisible();

    const mine = page
      .locator('.ah-feed > li[data-kind="user"] [data-testid="message"]')
      .first();
    await mine.scrollIntoViewIfNeeded();
    await mine.tap();
    await expect(card(page)).toHaveAttribute("data-card", "K01");
    await page.getByTestId("explain-close").tap();
    await expect(card(page)).toHaveCount(0);
    await page.getByTestId("explain-state").tap();
    await expect(page.getByTestId("explain-state-card")).toBeVisible();
    await page.getByTestId("explain-toggle").tap();
    await expect(bar(page)).toHaveCount(0);
  });
});
