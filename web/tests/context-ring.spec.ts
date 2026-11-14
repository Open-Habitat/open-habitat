import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { createHostTest, expect } from "./worker-host";

const capture = process.env.OH_VISUAL_CAPTURE === "1";
const captureDir = process.env.OH_VISUAL_CAPTURE_DIR;
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
  deviceScaleFactor: 2,
  reducedMotion: "reduce",
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

for (const held of [false, true]) {
  test(`@compaction-spacing keeps the conversation rhythm after ${held ? "a held message" : "a normal reply"}`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.clock.install();
    await page.addInitScript(() => {
      const listen = EventSource.prototype.addEventListener;
      EventSource.prototype.addEventListener = function (
        type: string,
        listener:
          | EventListenerOrEventListenerObject
          | ((this: EventSource, event: MessageEvent) => unknown)
          | null,
        options?: boolean | AddEventListenerOptions,
      ) {
        listen.call(
          this,
          type,
          (event) => {
            if (document.documentElement.dataset.holdConversation) return;
            if (typeof listener === "function")
              listener.call(this, event as MessageEvent);
            else listener?.handleEvent(event);
          },
          options,
        );
      };
    });
    await page.request.get("/fixture/scenario?value=pi-rewind");
    await page.goto("/workspaces");
    await page.getByTestId("github-sign-in").click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=42"]'))
      .click();
    const session = await (await page.request.get("/auth/session")).json();
    expect(
      (
        await page.request.put("/api/v1/account/preferences", {
          headers: {
            Origin: new URL(page.url()).origin,
            "X-Agent-Host-CSRF": session.csrf,
          },
          data: { experimental: { "rewind-conversation": true } },
        })
      ).ok(),
    ).toBe(true);
    await page.reload();
    await page
      .getByRole("navigation")
      .getByTestId(
        capture ? "workspace-aurinkokello" : "workspace-ordinary-dir",
      )
      .click();
    await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
    await expect(page.getByTestId("message-input")).toBeEnabled();
    if (held) {
      await expect(page).toHaveURL(/conversation=pi:/);
      const conversationId = new URL(page.url()).searchParams.get(
        "conversation",
      );
      if (!conversationId) throw new Error("Missing conversation ID");
      const identity = (
        await (await page.request.get("/api/v1/snapshot")).json()
      ).identity.web_identity_id;
      // An acknowledged held message stays visible until native history
      // contains it. Seed that short delivery grace before mounting the page.
      await page.evaluate(
        ({ identity, conversationId }) => {
          sessionStorage.setItem(
            `nah:${identity}:held:${conversationId}`,
            JSON.stringify([
              {
                command_id: crypto.randomUUID(),
                text: "Keep this message until the agent is ready",
                posted: true,
                delivered: Date.now(),
              },
            ]),
          );
        },
        { identity, conversationId },
      );
      await page.reload();
      await expect(page.getByTestId("waiting-message")).toBeVisible();
    }
    await send(page, "tiivistä konteksti 250000");
    const notice = page.getByTestId("compaction-notice");
    await expect(notice).toHaveAttribute("data-state", "running");
    // Freeze incoming events and poll timers, not the DOM or the connection:
    // native Pi can finish while the browser retains its running observation.
    await page.evaluate(() => {
      document.documentElement.dataset.holdConversation = "true";
    });
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
    for (const attachment of [false, true]) {
      if (attachment) {
        await page.locator('.ah-composer input[type="file"]').setInputFiles({
          name: "notes.txt",
          mimeType: "text/plain",
          buffer: Buffer.from("Synthetic notes"),
        });
        await expect(
          page.locator(".ah-composer").getByTestId("attachment-chip"),
        ).toBeVisible();
      }
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        for (const theme of ["light", "dark", "contrast"]) {
          await page.evaluate(
            (theme) => (document.documentElement.dataset.theme = theme),
            theme,
          );
          await notice.scrollIntoViewIfNeeded();
          // Let follow-latest release its temporary tail spacer after resize.
          await page.clock.runFor(300);
          await page.evaluate(() => document.fonts.ready);
          if (held)
            await expect(page.getByTestId("waiting-message")).toBeVisible();
          const gaps = await notice.evaluate((el) => {
            const row = el.getBoundingClientRect();
            const stream = el.parentElement;
            const stack = document.querySelector(".ah-composer-stack");
            if (!stream || !stack)
              throw new Error("Missing conversation layout");
            const previous = [...stream.querySelectorAll(".ah-feed > li")]
              .filter((node) => node.getBoundingClientRect().height > 0)
              .at(-1);
            const next =
              el.nextElementSibling ??
              [...stack.children].find(
                (node) => node.getBoundingClientRect().height > 0,
              );
            if (!previous || !next)
              throw new Error("Missing notice neighbours");
            return {
              above: row.top - previous.getBoundingClientRect().bottom,
              below: next.getBoundingClientRect().top - row.bottom,
              rhythm: Number.parseFloat(getComputedStyle(stack).rowGap),
            };
          });
          const name = `${held ? "held" : "reply"}-${attachment ? "attachment" : "plain"}-${width}-${theme}`;
          if (captureDir) {
            const { snapshot } = await import("../lab/session.mjs");
            await snapshot(page, `${captureDir}/${name}`, {
              labOrigin: new URL(page.url()).origin,
            });
          }
          expect.soft(gaps.above, `${name}: above`).toBeCloseTo(gaps.rhythm, 0);
          expect.soft(gaps.below, `${name}: below`).toBeCloseTo(gaps.rhythm, 0);
        }
      }
      if (attachment)
        await page
          .locator(".ah-composer")
          .getByTestId("attachment-remove")
          .click();
    }
    // Palaa tähän is a floating overlay, not another flow row. It may
    // cover the notice while open; closing it must restore the same gap.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page
      .getByTestId(/^message-menu-/)
      .first()
      .click();
    await page.getByRole("menuitem").click();
    const sheet = page.getByTestId("rewind-sheet");
    await expect(sheet).toBeVisible();
    await expect(
      page.locator(".ah-floating-controls").getByTestId("rewind-sheet"),
    ).toBeVisible();
    if (captureDir) {
      const { snapshot } = await import("../lab/session.mjs");
      await snapshot(
        page,
        `${captureDir}/${held ? "held" : "reply"}-return-sheet`,
        {
          labOrigin: new URL(page.url()).origin,
        },
      );
    }
    await page.getByTestId("rewind-close").click();
    await expect(sheet).toHaveCount(0);
    await notice.scrollIntoViewIfNeeded();
    await page.clock.runFor(300);
    const gap = await notice.evaluate((el) => {
      const stack = document.querySelector(".ah-composer-stack");
      if (!stack) throw new Error("Missing composer stack");
      return (
        stack.getBoundingClientRect().top -
        el.getBoundingClientRect().bottom -
        Number.parseFloat(getComputedStyle(stack).rowGap)
      );
    });
    expect(gap).toBeCloseTo(0, 0);
  });
}
