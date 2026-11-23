import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Replying to one agent message (reply-to-message, experimental) through the
// real gateway and daemon. The synthetic Pi answers with the exact text it
// received, so its answer shows what the daemon prepended; native history
// then carries the block back as the person's message's quote.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  locale: "fi-FI",
  timezoneId: "Europe/Helsinki",
  reducedMotion: "reduce",
});

async function prefer(page: Page, on: boolean) {
  const s = await (await page.request.get("/auth/session")).json();
  const put = await page.request.put("/api/v1/account/preferences", {
    headers: {
      Origin: new URL(page.url()).origin,
      "X-Agent-Host-CSRF": s.csrf,
    },
    data: { experimental: { "reply-to-message": on } },
  });
  expect(put.status()).toBe(200);
}

async function open(page: Page, width: number) {
  await page.setViewportSize({ width, height: 640 });
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.getByTestId("workspace-navigation")).toBeAttached();
}

async function send(page: Page, text: string) {
  await page.getByTestId("message-input").fill(text);
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
}

const answer = (page: Page, asked: string) =>
  page.getByTestId("stage-reply").filter({ hasText: `Kysyit: "${asked}".` });

for (const width of [1280, 390]) {
  test(`a reply quotes one agent message, reaches Pi with its excerpt and leads back to it ${width}`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await open(page, width);
    await prefer(page, true);
    await page.reload();
    if (width === 390) await page.getByTestId("navigation-open").click();
    await page
      .getByTestId("workspace-navigation")
      .getByTestId("workspace-ordinary-dir")
      .click();
    await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
    await send(page, "Ensimmäinen kysymys");
    await expect(answer(page, "Ensimmäinen kysymys")).toBeVisible({
      timeout: 20000,
    });
    await send(page, "Toinen kysymys");
    await expect(answer(page, "Toinen kysymys")).toBeVisible({
      timeout: 20000,
    });

    // The corner control beside Kopioi; the field's quote, and ✕ keeps the
    // draft.
    const first = answer(page, "Ensimmäinen kysymys");
    const corner = first.getByTestId("message-reply");
    await expect(corner).toBeVisible();
    await expect(corner).toHaveAttribute("aria-pressed", "false");
    await page.getByTestId("message-input").fill("luonnos");
    await corner.click();
    await expect(corner).toHaveAttribute("aria-pressed", "true");
    const quote = page.locator('.ah-cbox [data-testid="composer-quote"]');
    await expect(quote).toBeVisible();
    // The excerpt is the agent's first sentence, as the daemon will send it.
    await expect(quote.getByTestId("quote-jump")).toHaveText("Selvä. …");
    const audit = await new AxeBuilder({ page })
      .include('[data-testid="composer-quote"]')
      .analyze();
    expect(audit.violations).toEqual([]);
    await quote.getByTestId("quote-remove").click();
    await expect(quote).toHaveCount(0);
    await expect(page.getByTestId("message-input")).toHaveValue("luonnos");
    await expect(corner).toHaveAttribute("aria-pressed", "false");

    // Sent: Pi received the daemon's block in front of the person's text.
    await corner.click();
    await expect(quote).toBeVisible();
    await send(page, "Vastaan ensimmäiseen");
    await expect(quote).toHaveCount(0);
    const echoed = page
      .getByTestId("stage-reply")
      .filter({ hasText: "Vastaan ensimmäiseen" });
    await expect(echoed).toBeVisible({ timeout: 20000 });
    // Rendered as Markdown, so the closing tag itself is not shown.
    await expect(echoed).toContainText(
      /Kysyit: "<reply-to entry="[\w-]+">\\nSelvä\. …\\n.*\\n\\nVastaan ensimmäiseen"/,
    );

    // The person's message shows the quote, and its own text without the
    // block.
    const mine = page
      .getByTestId("message")
      .filter({ has: page.getByTestId("sent-quote") });
    await expect(mine).toHaveCount(1);
    await expect(mine.getByTestId("user-content")).toHaveText(
      "Vastaan ensimmäiseen",
    );
    await expect(mine.getByTestId("sent-quote")).toContainText("Selvä. …");

    // Tapping it brings the original into view and outlines it briefly.
    await page.locator(".ah-conversation-stream").evaluate((el) => {
      el.dispatchEvent(new WheelEvent("wheel", { deltaY: 400 }));
      el.scrollTop = el.scrollHeight;
    });
    await mine.getByTestId("sent-quote").click();
    const target = page.locator(".ah-search-target");
    await expect(target).toHaveCount(1);
    await expect(target).toContainText('Kysyit: "Ensimmäinen kysymys".');
    await expect(target).toBeInViewport();
    await expect(page.getByTestId("jump-band")).toHaveCount(0);
    await expect(target).toHaveCount(0, { timeout: 5000 });
  });
}

test("with the switch off there is no corner control, and a sent reply keeps its quote", async ({
  page,
}) => {
  test.setTimeout(90000);
  await open(page, 1280);
  await prefer(page, true);
  await page.reload();
  await page
    .getByTestId("workspace-navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await send(page, "Kysymys");
  await expect(answer(page, "Kysymys")).toBeVisible({ timeout: 20000 });
  await answer(page, "Kysymys").getByTestId("message-reply").click();
  await send(page, "Vastaus");
  await expect(page.getByTestId("sent-quote")).toBeVisible({ timeout: 20000 });

  await prefer(page, false);
  await page.reload();
  await expect(answer(page, "Kysymys")).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId("message-reply")).toHaveCount(0);
  await expect(page.getByTestId("sent-quote")).toBeVisible();
  await expect(page.locator('[data-testid="composer-quote"]')).toHaveCount(0);
});
