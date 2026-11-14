import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { archiveFromConfirmedView } from "./archive-proof";
import { recordStopStates, stopStates } from "./stop-states";
import { expect, test } from "./worker-host";

const host = hostOrigin;
// The host shares both controller capacity and the OAuth peer admission bucket
// across tests. Advance fixture time between cases (never within a session),
// so earlier logins cannot exhaust a later case's real gateway rate limit.
test.beforeEach(async ({ page }) => {
  expect((await page.request.get("/fixture/reset-clock")).status()).toBe(204);
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
});
test.use({
  baseURL: host,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 720 },
});
async function expectPhoneComposerWithinViewport(
  page: import("@playwright/test").Page,
) {
  // Restore the caller's viewport: the phone header moves archive and Tiedot
  // into its menu, which the desktop steps after this check do not open.
  const previous = page.viewportSize();
  await page.setViewportSize({ width: 390, height: 844 });
  const composer = page.locator(
    ".ah-conversation-frame .ah-composer-stack > .ah-composer",
  );
  await expect(composer).toBeVisible();
  const bounds = await composer.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const actions = element.querySelector(".ah-cbox")?.getBoundingClientRect();
    return {
      top: box.top,
      bottom: box.bottom,
      actionsBottom: actions?.bottom ?? 9999,
      scrolls: element.scrollHeight > element.clientHeight,
    };
  });
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(844);
  expect(bounds.actionsBottom).toBeLessThanOrEqual(844);
  expect(bounds.scrolls).toBe(false);
  if (previous) await page.setViewportSize(previous);
}
async function readyConversation(page: import("@playwright/test").Page) {
  // The optimistic creation view has an enabled editor and command palette
  // too, and so does the loading view the native route shows until its cold
  // status read returns. Both have their own Tiedot toggle that the opened
  // header replaces. Only the opened native conversation has archive controls
  // (close while it is still empty).
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  await expect(
    page
      .locator(".ah-agent-header")
      .getByTestId(/^(archive-conversation|dialog-close)$/),
  ).toBeVisible();
  await expect(page.getByTestId("message-input")).toBeEnabled();
}
async function refreshConversation(
  page: import("@playwright/test").Page,
  beforeCheck?: () => Promise<unknown>,
) {
  await readyConversation(page);
  const check = page.getByTestId("conversation-recheck");
  const details = page
    .getByRole("button")
    .and(page.getByTestId("workspace-details"));
  // Recovery exposes this action without Tiedot. Close any existing popover
  // first so it cannot cover that action; open it only for the ordinary view.
  if ((await details.getAttribute("aria-expanded")) === "true")
    await details.click();
  if (!(await check.isVisible())) await details.click();
  await expect(check).toBeVisible();
  await beforeCheck?.();
  await check.click();
}
async function open(page: import("@playwright/test").Page) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await expect(
    page.getByTestId(/^(new-conversation|conversation-start)$/),
  ).toBeEnabled();
}
test("@browser-conversation new controller stays calm and shares settled state with navigation", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const header = page.locator(".ah-agent-header");
  await readyConversation(page);
  const conversationURL = new URL(page.url());
  const row = page.locator(".ah-agent-item").filter({
    has: page.locator(
      `a[href="${conversationURL.pathname}${conversationURL.search}"]`,
    ),
  });
  await expect(header.locator(".ah-status-neutral")).toBeVisible();
  await expect(row.getByTestId("rail-mark")).toBeVisible();
  await expect(page.getByTestId("history-unavailable")).toHaveCount(0);
  await expect(page.getByTestId("recap-heading")).toHaveCount(0);
  await page.getByTestId("message-input").fill("Testaa uusi keskustelu");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  const id = new URL(page.url()).searchParams.get("conversation");
  if (!id) throw new Error("missing conversation id");
  await expect
    .poll(async () => {
      const response = await page.request.get(
        `/api/v1/conversations/${id.slice(3)}/status`,
      );
      const status = await response.json();
      return status.state === "idle" && status.native_history === "present";
    })
    .toBe(true);
  await expect(
    page.locator(".ah-agent-header").locator(".ah-status-neutral"),
  ).toBeVisible();
  await expect(row.getByTestId("rail-mark")).toBeVisible();
  await expect(page.getByTestId("recap-heading")).toHaveCount(0);
  await expect(page.getByTestId("history-unavailable")).toHaveCount(0);
});

test("@browser-conversation agent work default is a device preference that survives reload", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId("account-menu-trigger").click();
  const choice = page.getByTestId("segmented-choice");
  await choice.getByTestId("segment-visible").click();
  await expect(choice.getByTestId("segment-visible")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.reload();
  await page.getByTestId("account-menu-trigger").click();
  await expect(
    page.getByTestId("segmented-choice").getByTestId("segment-visible"),
  ).toHaveAttribute("aria-pressed", "true");
});

test("@browser-conversation saved assistant turn exposes bash command and folds work without hiding reply", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await page.getByTestId("message-input").fill("Tarkista tiedostot");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  const turn = page.getByTestId("agent-turn").first();
  await expectNativeContent(turn, "Selvä. Kysyit:", { timeout: 30000 });
  await page.reload();
  // After a reload the Markdown renderer loads lazily and replaces the plain
  // fallback, which moves the stage toggle; a press whose pointer lands on a
  // moved button is cancelled. Click once the rendered replies are in place.
  await expect(turn.locator(".ah-markdown").first()).toBeVisible();
  await expect(turn.locator(".ah-markdown[style]")).toHaveCount(0);
  await turn.getByTestId("history-stage-toggle").click();
  const bash = turn
    .getByTestId("tool-row")
    .and(page.locator('[data-tool-name="bash"]'))
    .getByTestId("history-tool-toggle");
  await expect(bash).toHaveAttribute("aria-expanded", "false");
  await expect(bash.locator(".ah-tool-target")).toHaveText("ls");
  await bash.click();
  await expectNativeContent(turn, "$ ls", {});
  await expect(turn.getByTestId("output-copy")).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include(".ah-bash-card").analyze())
      .violations,
  ).toEqual([]);
  await expect(turn.getByTestId("tool-arguments")).toHaveCount(0);
  await expectNativeContent(turn, /call_[a-z0-9]/, {
    count: 0,
    visible: false,
  });
  await turn.getByTestId("history-stage-toggle").click();
  await expectNativeContent(turn, "$ ls", { count: 0, visible: false });
  await expectNativeContent(turn, "Selvä. Kysyit:", {});
});

test("@browser-conversation latest action follows expanded output", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await page.getByTestId("message-input").fill("pitkä tuloste");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expectNativeContent(page, "Selvä. Kysyit:", { timeout: 30000 });
  await page.reload();
  // As above: let the lazy Markdown renderer settle the layout first.
  await expect(
    page.locator(".ah-agent-turn .ah-markdown").first(),
  ).toBeVisible();
  await expect(page.locator(".ah-agent-turn .ah-markdown[style]")).toHaveCount(
    0,
  );
  await page.getByTestId("history-stage-toggle").click();
  const bash = page
    .getByTestId("tool-row")
    .and(page.locator('[data-tool-name="bash"]'))
    .getByTestId("history-tool-toggle");
  await expect(bash).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("jump-latest")).toHaveCount(0);
  await bash.click();
  await page
    .getByTestId("output-expand")
    .filter({ visible: true })
    .evaluate((button: HTMLButtonElement) => button.click());
  await page.locator(".ah-conversation-stream").evaluate((node) => {
    node.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -400, bubbles: true }),
    );
    node.scrollTop = 0;
    node.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  const latest = page.getByTestId("jump-latest");
  await expect(latest).toBeVisible();
  await latest.click();
  await bash.click();
  await expect(latest).toHaveCount(0);
});

test("@browser-conversation workspace plus starts one native conversation", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("navigation")
    .getByTestId("workspace-start-ordinary-dir")
    .click();
  await expect(page).toHaveURL(/conversation=pi/);
  await expect(page.getByTestId("message-input")).toBeVisible();
  await expect(page.getByTestId("conversation-retitle")).toBeDisabled();
  // pilot.231: a stream recovery before the first message turned the empty,
  // unwritten conversation into "Historiaa ei saada". Drop the stream and
  // refuse its resume cursor once, then let it reconnect.
  let refused = false;
  await page.route("**/api/v1/events?*", async (route) => {
    if (refused) return route.continue();
    refused = true;
    await route.fulfill({ status: 409, body: "" });
  });
  const reconnected = page.waitForResponse(
    (r) => refused && r.url().includes("/api/v1/events?") && r.ok(),
  );
  expect(
    (
      await page.request.get("/fixture/daemon-restart?transport_only=1")
    ).status(),
  ).toBe(204);
  await reconnected;
  const frame = page.locator(".ah-conversation-frame");
  await expect(frame.getByTestId("history-read-error")).toHaveCount(0);
  await expect(page.getByTestId("conversation-recheck")).toHaveCount(0);
  await expect(page.getByTestId("message-input")).toBeEnabled();
});

// pilot.643: a conversation's history read failed after a reload and the
// only sign of it above the composer was a lone recheck button; the reason
// was at the top of the timeline, out of view. The reason and the check sit
// together, and the check shows that it ran.
test("@browser-conversation failing history read says why and shows its check", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi/);
  const id = new URL(page.url()).searchParams.get("conversation");
  if (!id) throw new Error("missing conversation");
  await page.getByTestId("message-input").fill("muista tämä historia");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expectNativeContent(page, 'Selvä. Kysyit: "muista tämä historia".', {});
  let failing = true;
  let held: Promise<void> | undefined;
  await page.route("**/api/v1/agents/*/history*", async (route) => {
    if (!failing) return route.continue();
    await held;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        schema_version: 1,
        error: {
          code: "native_source_unavailable",
          message: "Request could not be completed",
          retryable: false,
          correlation_id: "req_00000000",
        },
      }),
    });
  });
  await page.reload();
  const banner = page.getByTestId("history-unavailable");
  // Shown only once the quiet re-read has also been refused, and without
  // sending the person to the administrator for what may pass by itself.
  await expect(banner).toContainText("Historiaa ei saada", { timeout: 15_000 });
  await expect(banner).toContainText("yritetään itsestään uudelleen");
  await expect(banner).not.toContainText("ylläpitäjälle");
  await expect(page.getByTestId("history-read-error")).toHaveCount(0);
  await expect(banner).toHaveAttribute("data-tone", "neutral");
  const check = banner.getByTestId("conversation-recheck");
  await expect(check).toHaveText("Tarkista keskustelun tila");
  let release = () => {};
  held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await check.click();
  await expect(check).toHaveText("Tarkistetaan…");
  release();
  await expect(banner).toHaveAttribute("data-state", "done");
  await expect(banner).toContainText("historiaa ei vieläkään saada");
  await expect(banner).toContainText("kerro ylläpitäjälle");
  failing = false;
  await check.click();
  await expect(banner).toHaveCount(0);
  await expect(page.getByTestId("conversation-recheck")).toHaveCount(0);
  await expectNativeContent(page, 'Selvä. Kysyit: "muista tämä historia".', {});
});

// 12.11.2026: a history read refused once while Pi appended, and the card
// stayed up through a 52-minute tool run. A momentary refusal is read again
// quietly and never shown.
test("@browser-conversation a momentary history refusal is read again without a card", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi/);
  await page.getByTestId("message-input").fill("muista tämä historia");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expectNativeContent(page, 'Selvä. Kysyit: "muista tämä historia".', {});
  let refused = 0;
  await page.route("**/api/v1/agents/*/history*", async (route) => {
    if (refused >= 1) return route.continue();
    refused++;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        schema_version: 1,
        error: {
          code: "native_source_unavailable",
          message: "Request could not be completed",
          retryable: false,
          correlation_id: "req_00000000",
        },
      }),
    });
  });
  await page.reload();
  const seen = page
    .getByTestId("history-unavailable")
    .waitFor({ timeout: 8_000 })
    .then(
      () => true,
      () => false,
    );
  await expectNativeContent(page, 'Selvä. Kysyit: "muista tämä historia".', {});
  expect(refused).toBe(1);
  expect(await seen).toBe(false);
});

// A full quota cut a record of the history: no re-read helps, so the card
// names storage and what helps instead of the administrator.
test("@browser-conversation a history a full quota cut names storage", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi/);
  await page.getByTestId("message-input").fill("muista tämä historia");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expectNativeContent(page, 'Selvä. Kysyit: "muista tämä historia".', {});
  await page.route("**/api/v1/agents/*/history*", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        schema_version: 1,
        error: {
          code: "native_history_cut",
          message: "Request could not be completed",
          retryable: false,
          correlation_id: "req_00000000",
        },
      }),
    }),
  );
  await page.reload();
  const banner = page.getByTestId("history-unavailable");
  await expect(banner).toHaveAttribute("data-reason", "storage_cut");
  await expect(banner).toContainText(
    "Tallennustila loppui kesken tallennuksen",
  );
  await expect(banner).toContainText("Vapauta tilaa");
  await expect(banner).not.toContainText("kerro ylläpitäjälle");
  await expect(banner.getByTestId("conversation-recheck")).toHaveCount(0);
});

test("@browser-conversation own message shows every line it fits; a clipped one fades only its last", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi/);
  const editor = page.getByTestId("message-input");
  const replies = page
    .getByTestId("stage-reply")
    .and(page.locator('[data-reply-role="final"]'));
  const sendText = async (text: string) => {
    const before = await replies.count();
    await editor.fill(text);
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    await expect(replies).toHaveCount(before + 1, { timeout: 20000 });
  };
  // Darkest text per line band, from the rendered pixels: a fade by any
  // means (mask, overlay, opacity) makes a band lighter than the first.
  const bandInk = async (bubble: import("@playwright/test").Locator) => {
    // Reading an older bubble must suspend tail-following before capture;
    // otherwise the arriving reply can scroll it behind the fixed header.
    await page.locator(".ah-conversation-stream").evaluate((node) => {
      node.dispatchEvent(
        new WheelEvent("wheel", { deltaY: -400, bubbles: true }),
      );
      node.scrollTop = 0;
    });
    await bubble.evaluate((node) => node.scrollIntoView({ block: "center" }));
    const png = (await bubble.screenshot()).toString("base64");
    const { height, lineHeight } = await bubble.evaluate((e) => ({
      height: e.getBoundingClientRect().height,
      lineHeight: Number.parseFloat(getComputedStyle(e).lineHeight),
    }));
    return page.evaluate(
      async ({ png, height, lineHeight }) => {
        const bytes = Uint8Array.from(atob(png), (c) => c.charCodeAt(0));
        const image = await createImageBitmap(
          new Blob([bytes], { type: "image/png" }),
        );
        const canvas = new OffscreenCanvas(image.width, image.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("no canvas");
        context.drawImage(image, 0, 0);
        const scale = image.height / height;
        const pixels = context.getImageData(0, 0, image.width, image.height);
        const bands: number[] = [];
        for (let top = 0; top + lineHeight <= height + 0.5; top += lineHeight) {
          let darkest = 255;
          // Glyph bodies down to the baseline: where a fade bites first.
          const from = Math.round((top + lineHeight * 0.45) * scale);
          const to = Math.min(
            image.height,
            Math.round((top + lineHeight * 0.8) * scale),
          );
          for (let y = from; y < to; y++)
            for (let x = 0; x < image.width; x++) {
              const i = (y * image.width + x) * 4;
              const value =
                0.2126 * pixels.data[i] +
                0.7152 * pixels.data[i + 1] +
                0.0722 * pixels.data[i + 2];
              if (value < darkest) darkest = value;
            }
          bands.push(darkest);
        }
        return bands;
      },
      { png, height, lineHeight },
    );
  };
  const last = () =>
    page.locator('.ah-feed > li[data-kind="user"] .ah-user-content').last();
  // Jari's seven typed lines fit the eight-line bubble: all are as legible
  // as the first.
  await sendText(
    Array.from(
      { length: 7 },
      (_, i) => `Rivi ${i + 1}: tämä on viestin rivi numero ${i + 1}.`,
    ).join("\n"),
  );
  // Measure each typed line in the browser, not merely textContent: normal
  // Markdown soft breaks retain newlines in the DOM but paint one paragraph.
  const lineTops = await last().evaluate((node) => {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const tops: number[] = [];
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      for (const match of text.textContent?.matchAll(/Rivi [1-7]:/g) ?? []) {
        const range = document.createRange();
        range.setStart(text, match.index);
        range.setEnd(text, match.index + match[0].length);
        tops.push(range.getBoundingClientRect().top);
      }
    }
    return tops;
  });
  expect(lineTops).toHaveLength(7);
  for (let i = 1; i < lineTops.length; i++)
    expect(lineTops[i]).toBeGreaterThan(lineTops[i - 1]);
  const fitting = await bandInk(last());
  expect(fitting.length).toBeGreaterThan(1);
  for (const band of fitting.filter((b) => b < 200))
    expect(band).toBeLessThanOrEqual(fitting[0] + 10);
  await expect(page.getByTestId("expand-message")).toHaveCount(0);
  // A long message is clamped with a clear expand; only its last visible line fades.
  await sendText(
    Array.from({ length: 30 }, (_, i) => `Pitkän viestin sana ${i + 1}`)
      .join(" ")
      .repeat(3),
  );
  await expect(page.getByTestId("expand-message")).toBeVisible();
  const clipped = await bandInk(last());
  expect(clipped.length).toBe(8);
  for (const band of clipped.slice(0, 7))
    expect(band).toBeLessThanOrEqual(clipped[0] + 10);
  expect(clipped[7]).toBeGreaterThan(clipped[0] + 10);
});

test("@browser-conversation create, send once, reconnect and old history stays read-only", async ({
  page,
}) => {
  await open(page);
  const create = page.getByTestId(/^(new-conversation|conversation-start)$/);
  await expect(create).toBeEnabled();
  await expect(page.getByTestId("check-conversation-list")).toHaveCount(0);
  // The identity-wide stream was opened before creating a conversation.
  // Creating it must not open a second stream (measured in the warm-switch test).
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi%3A|conversation=pi:/);
  await expect(page.getByTestId("message-input")).toBeVisible();
  await expect(page.getByTestId("conversation-recheck")).toHaveCount(0);
  await page.getByTestId("message-input").fill("Synteettinen testipyyntö");
  let sends = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/send")) sends++;
  });
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  // Accepted delivery clears the submitted draft but does not claim turn completion.
  await expect(page.getByTestId("message-input")).toHaveValue("");
  expect(sends).toBe(1);
  await page.reload();
  await expect(page.getByTestId("message-input")).toBeVisible();
  await expect(page.getByTestId("message-awaiting-native")).toHaveCount(0);
  await page.locator("main").evaluate((main) => {
    main.scrollTop = main.scrollHeight;
  });
  await page.screenshot({
    path: "test-results/evidence/browser-conversation-reconnect.png",
  });
  // The short synthetic turn may already have settled after reload. An idle
  // conversation must not offer a meaningless interruption request.
  await page.goto("/agents/pi:11111111-1111-4111-8111-111111111111");
  await expect(
    page.locator(".ah-read-only-footer").getByTestId("read-only-indicator"),
  ).toBeVisible();
  await expect(page.getByTestId("message-input")).toHaveCount(0);
});
test("@browser-conversation HTTP fallback permits one send while journal is unavailable", async ({
  page,
}) => {
  await open(page);
  await page.route("**/api/v1/events?after=*", (route) =>
    route.fulfill({ status: 503, body: "unavailable" }),
  );
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const editor = page.getByTestId("message-input");
  await expect(editor).toBeVisible();
  await editor.fill("Fallback");
  await expect(
    page.getByTestId("send").and(page.locator('[data-mode="send"]')),
  ).toBeEnabled();
  let sends = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/send")) sends++;
  });
  const sent = page.waitForResponse((response) =>
    response.url().endsWith("/send"),
  );
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(editor).toHaveValue("");
  // The field empties at once, but while the conversation is still being
  // created the message is held and posted only after creation, so a slow
  // create leaves no POST yet. Count once the send has been answered.
  expect((await sent).ok()).toBe(true);
  expect(sends).toBe(1);
});

test("@browser-conversation transient status failure retries with healthy journal", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const editor = page.getByTestId("message-input");
  await expect(editor).toBeVisible();
  let failures = 0;
  // Arm only after the native status controls exist. Otherwise a slow cold
  // open consumes the failure and tests cold-load refusal, not refresh retry.
  await refreshConversation(page, () =>
    page.route("**/api/v1/conversations/*/status*", async (route) => {
      if (failures++ === 0)
        await route.fulfill({ status: 503, body: "unavailable" });
      else await route.continue();
    }),
  );
  await expect.poll(() => failures).toBeGreaterThan(1);
  await expect(editor).toBeEnabled({ timeout: 10000 });
});

// The synthetic Pi has no receipt/question/settlement scenario yet. Intercept
// validated private gateway responses after the real TLS login/create/send path.
// Ordinary acceptance is covered by the native send/reload and lost-ack journeys.
for (const outcome of ["pending", "rejected", "uncertain"] as const) {
  test(`@browser-conversation validated ${outcome} send receipt never reposts`, async ({
    page,
  }) => {
    await open(page);
    await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
    // The creation view's field is enabled before the controller is ready,
    // and a message sent there is held for the new conversation instead;
    // this case is about the opened conversation's own send.
    await readyConversation(page);
    let lookups = 0;
    // Pi's history showing the message would prove it arrived, so the
    // uncertain message never reaches the host; its status names it.
    let held = "";
    if (outcome === "uncertain")
      await page.route("**/api/v1/conversations/*/send", (route) => {
        held = (route.request().postDataJSON() as { command_id: string })
          .command_id;
        return route.fulfill({
          json: { schema_version: 1, command_id: held, state: "pending" },
        });
      });
    await page.route("**/api/v1/conversations/*/status", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      if (held) body.command_id = held;
      if (body.command_id) body.send_receipt = outcome;
      await route.fulfill({ response, json: body });
    });
    await page.route(
      "**/api/v1/conversations/*/receipt?command_id=*",
      async (route) => {
        lookups++;
        const command_id = new URL(route.request().url()).searchParams.get(
          "command_id",
        );
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            schema_version: 1,
            command_id,
            state: outcome,
          }),
        });
      },
    );
    let sends = 0;
    page.on("request", (request) => {
      if (request.url().endsWith("/send")) sends++;
    });
    await page.getByTestId("message-input").fill(`Synteettinen ${outcome}`);
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    // A pending message is drawn as the person's message on its way.
    const observation =
      outcome === "pending"
        ? page.locator('[data-testid="message"][data-delivery="pending"]')
        : outcome === "uncertain"
          ? page.getByTestId("send-uncertain")
          : page.locator(`.ah-send-${outcome}`);
    await expect(observation).toBeVisible();
    await expectPhoneComposerWithinViewport(page);
    if (outcome === "uncertain") {
      // One warning with one action; the text is back in the field.
      await expect(
        observation.getByTestId("conversation-recheck"),
      ).toBeVisible();
      await expect(page.getByTestId("conversation-recheck")).toHaveCount(1);
      await expect(page.getByTestId("send-receipt")).toHaveCount(0);
      await expect(page.getByTestId("message-input")).toHaveValue(
        "Synteettinen uncertain",
      );
      await expect(
        page.getByTestId("send").and(page.locator('[data-mode="send"]')),
      ).toBeDisabled();
    }
    expect(sends).toBe(1);
    const before = lookups;
    await refreshConversation(page);
    if (outcome === "pending")
      // Pi's history may show it by now; either way it is drawn once.
      await expect(
        page
          .getByTestId("conversation-timeline")
          .getByTestId("user-content")
          .filter({ hasText: "Synteettinen pending" }),
      ).toHaveCount(1);
    else await expect(observation).toBeVisible();
    expect(lookups).toBe(before); // matching status receipt avoids an extra request
    // The page still polls status. Let intercepted fetches finish before
    // Playwright disposes their responses during page teardown.
    await page.unrouteAll({ behavior: "wait" });
  });
}
test("@browser-conversation safe question and settled boundary require validated status and native key", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page.getByTestId("message-input")).toBeVisible();
  await page.route("**/api/v1/conversations/*/status", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.pending_question = {
      request_id: "question-1",
      question_kind: "unknown",
      prompt: "<script>alert(1)</script>",
      choices: ["<b>ei html</b>"],
    };
    body.turn_settled = {
      state: "settled",
      observed_at: "2026-09-30T13:53:00Z",
      native_key: "not-in-history",
    };
    await route.fulfill({ response, json: body });
  });
  await refreshConversation(page);
  await expect(page.getByTestId("agent-question")).toContainText(
    "<script>alert(1)</script>",
  );
  await expect(
    page.getByTestId("agent-question").getByRole("button"),
  ).toHaveCount(1); // Unknown kind can only be cancelled.
  await expect(page.getByTestId("question-cancel")).toBeVisible();
  await expect(page.locator(".ah-settled")).toHaveCount(0);
  await expect(
    page.getByTestId("agent-question").locator("script"),
  ).toHaveCount(0);
});
test("@browser-conversation answers once, survives reload, and reports stale without retry", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page.getByTestId("message-input")).toBeVisible();
  await page.route("**/api/v1/conversations/*/status", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.pending_question = {
      request_id: "q-once",
      question_kind: "input",
      prompt: "Kirjoita jatko",
      choices: [],
    };
    await route.fulfill({ response, json: body });
  });
  let writes = 0;
  await page.route("**/api/v1/conversations/*/question", async (route) => {
    writes++;
    expect(route.request().postDataJSON()).toEqual({
      request_id: "q-once",
      action: "answer",
      value: "Jatka",
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        schema_version: 1,
        request_id: "q-once",
        state: "uncertain",
      }),
    });
  });
  await refreshConversation(page);
  const question = page.getByTestId("agent-question");
  await question.getByRole("textbox").fill("Jatka");
  await question.getByTestId("question-answer").click();
  await expect(question).toBeVisible();
  await expect(question.getByRole("button")).toHaveCount(0);
  await page.reload();
  await expect(question).toBeVisible();
  expect(writes).toBe(1);
});

test("@browser-conversation unknown question cancels once and a refused answer stays stale", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page.getByTestId("message-input")).toBeVisible();
  await page.route("**/api/v1/conversations/*/status", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.pending_question = {
      request_id: "q-unknown",
      question_kind: "unknown",
      prompt: "Tuntematon",
      choices: [],
    };
    await route.fulfill({ response, json: body });
  });
  let writes = 0;
  await page.route("**/api/v1/conversations/*/question", async (route) => {
    writes++;
    expect(route.request().postDataJSON()).toEqual({
      request_id: "q-unknown",
      action: "cancel",
    });
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ code: "control_uncertain" }),
    });
  });
  await refreshConversation(page);
  const question = page.getByTestId("agent-question");
  await expect(question.getByRole("button")).toHaveCount(1);
  await question.getByTestId("question-cancel").click();
  await expect(question).toBeVisible();
  await expect(question.getByRole("button")).toHaveCount(0);
  expect(writes).toBe(1);
});
test("@browser-conversation in-flight send remains pending through missing receipt", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  // Sent from the creation view the message would be held instead.
  await readyConversation(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route("**/api/v1/conversations/*/send", async (route) => {
    started();
    await held;
    await route.continue();
  });
  let sends = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/send")) sends++;
  });
  const missingReceipt = page.waitForResponse(
    (response) =>
      response.url().includes("/receipt?command_id=") &&
      response.status() === 404,
  );
  await page.getByTestId("message-input").fill("Odota kuittausta");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await entered;
  await expect(
    page.locator('[data-testid="message"][data-delivery="pending"]'),
  ).toBeVisible();
  await expect(page.getByTestId("message-input")).toHaveValue("");
  await refreshConversation(page);
  await missingReceipt;
  await expect(page.getByTestId("send-uncertain")).toHaveCount(0);
  release();
  await expect(page.getByTestId("message-input")).toHaveValue("");
  await expect(page.locator(".ah-send-accepted")).toHaveCount(0);
  expect(sends).toBe(1);
});
test("@browser-conversation settled turn uses its native strip without a duplicate receipt", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page.getByTestId("message-input")).toBeVisible();
  await expect(page).toHaveURL(/conversation=pi:/);
  const agentId = new URL(page.url()).searchParams.get("conversation");
  expect(agentId).toMatch(/^pi:/);
  await page.getByTestId("message-input").fill("Valmis vastaus");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  let key = "";
  await expect
    .poll(async () => {
      const response = await page.request.get(
        `/api/v1/agents/${agentId}/history`,
      );
      if (!response.ok()) return false;
      const body = await response.json();
      key =
        body.entries?.find(
          (entry: { kind: string; entry_key: string }) =>
            entry.kind === "assistant",
        )?.entry_key ?? "";
      return !!key;
    })
    .toBe(true);
  await page.route("**/api/v1/conversations/*/status", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.turn_settled = {
      state: "settled",
      native_key: key,
      observed_at: "2026-09-30T13:53:00Z",
    };
    await route.fulfill({ response, json: body });
  });
  await refreshConversation(page);
  await expect(page.locator(".ah-settled")).toHaveCount(0);
  await expect(page.locator(".ah-turn-stage").first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".ah-turn-stage").first()).toBeVisible();
  await expectPhoneComposerWithinViewport(page);
});
test("@browser-conversation only reader scroll suspends following and returning to end resumes it", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  // An empty session is an authored intro, which intentionally does not follow
  // a conversation tail. Exercise scrolling after native history is present.
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  await page.getByTestId("message-input").fill("Synthetic scroll test");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  const id = new URL(page.url()).searchParams.get("conversation");
  await expect
    .poll(async () => {
      const response = await page.request.get(
        `/api/v1/conversations/${id?.slice(3)}/status`,
      );
      const status = await response.json();
      return status.state === "idle" && status.native_history === "present";
    })
    .toBe(true);
  const stream = page.locator(".ah-conversation-stream");
  await expect(stream.locator("[data-reading-intro]")).toHaveCount(0);
  await page.addStyleTag({
    content: ".ah-timeline { min-height: 4000px !important; }",
  });
  await stream.evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect
    .poll(() =>
      stream.evaluate((n) => n.scrollHeight - n.scrollTop - n.clientHeight),
    )
    .toBeLessThan(2);
  await stream.evaluate((node) =>
    node.dispatchEvent(new WheelEvent("wheel", { deltaY: 200, bubbles: true })),
  );
  const grow = () =>
    stream.evaluate((node) => {
      const li = document.createElement("li");
      li.style.height = "300px";
      node.querySelector(".ah-timeline")?.append(li);
    });
  await grow();
  await expect
    .poll(() =>
      stream.evaluate((n) => n.scrollHeight - n.scrollTop - n.clientHeight),
    )
    .toBeLessThan(2);
  await stream.evaluate((node) => {
    node.dispatchEvent(
      new WheelEvent("wheel", { deltaY: -400, bubbles: true }),
    );
    node.scrollTop = 0;
  });
  await expect(page.getByTestId("jump-latest")).toBeVisible();
  await stream.evaluate((node) => {
    node.dispatchEvent(
      new WheelEvent("wheel", { deltaY: 4000, bubbles: true }),
    );
    node.scrollTop = node.scrollHeight;
  });
  await expect(page.getByTestId("jump-latest")).toHaveCount(0);
  await grow();
  await expect
    .poll(() =>
      stream.evaluate((n) => n.scrollHeight - n.scrollTop - n.clientHeight),
    )
    .toBeLessThan(2);
});

test("@browser-conversation missing daemon control opens surviving native history", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi%3A|conversation=pi:/);
  const id = new URL(page.url()).searchParams.get("conversation");
  if (!id) throw new Error("missing created conversation");
  await page.route(
    `**/api/v1/conversations/${id.slice(3)}/status*`,
    async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: '{"code":"resource_not_found"}',
      });
    },
  );
  await page.reload();
  await expect(page).toHaveURL(`/agents/${id}`);
  await expect(
    page.locator('[data-testid^="connection-"][data-state]'),
  ).toHaveCount(0);
  await expect(page.getByTestId("message-input")).toHaveCount(0);
});

test("@browser-conversation lost create acknowledgement is rechecked on reload without duplicate creation", async ({
  page,
}) => {
  await open(page);
  let attempts = 0;
  await page.route("**/api/v1/conversations", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    attempts++;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(
    page.getByRole("main").getByTestId("creation-problem"),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByTestId(/^(new-conversation|conversation-start)$/),
  ).toBeEnabled();
  expect(attempts).toBe(1);
});
test("@browser-conversation uncertain send survives reload without duplicate", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  // Sent from the creation view the message would be held instead.
  await readyConversation(page);
  await page.getByTestId("message-input").fill("Älä lähetä toistamiseen");
  let attempts = 0;
  await page.route("**/api/v1/conversations/*/send", async (route) => {
    attempts++;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(page.getByTestId("send-uncertain")).toBeVisible();
  // One warning, its check the only action.
  await expect(
    page.getByTestId("send-uncertain").getByTestId("conversation-recheck"),
  ).toBeVisible();
  await expect(page.getByTestId("send-error")).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("send-uncertain")).toBeVisible();
  await expect(page.getByTestId("message-input")).toHaveValue(
    "Älä lähetä toistamiseen",
  );
  await expect(
    page.getByTestId("send").and(page.locator('[data-mode="send"]')),
  ).toBeDisabled();
  expect(attempts).toBe(1);
  const beforeRefusal = await page.getByTestId("send-uncertain").textContent();
  await page.getByTestId("message-input").fill("ping");
  await page.getByTestId("message-input").press("Enter");
  await expect(page.getByTestId("send-uncertain")).not.toHaveText(
    beforeRefusal ?? "",
  );
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(
      page.getByTestId("notice-stack").locator(".ah-warning"),
    ).toHaveCount(1);
    await expect(page.getByTestId("composer-notice")).toHaveCount(0);
    await expect(page.getByTestId("message-input")).toHaveValue("ping");
    expect(attempts).toBe(1);
  }
  await page.getByTestId("send-uncertain").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/evidence/browser-conversation-uncertain.png",
  });
});

test("@browser-conversation malformed host status fails closed without rendering HTML", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  // The loading view's field is usable too; wait for the opened conversation.
  await expect(
    page.locator(".ah-agent-header").getByTestId("conversation-retitle"),
  ).toBeVisible();
  await page.route("**/api/v1/conversations/*/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        schema_version: 1,
        agent_id: "<script>alert(1)</script>",
      }),
    }),
  );
  await refreshConversation(page);
  await expect(page.getByTestId("conversation-problem")).toBeVisible();
  await expect(page.getByTestId("message-input")).toBeVisible();
  await expect(page.locator("main script")).toHaveCount(0);
});

test("@browser-conversation settings does not recheck the Pi gate; returning and foreground clicks do not revalidate", async ({
  page,
}) => {
  await open(page);
  let checks = 0;
  page.on("request", (r) => {
    if (r.url().includes("/onboarding/pi/status")) checks++;
  });
  await page.getByTestId("account-menu-trigger").click();
  await page
    .getByRole("menuitem")
    .and(page.locator('[data-menu-item="settings"]'))
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page
    .getByTestId("settings-navigation")
    .getByRole("link")
    .and(page.locator('a[href="/settings/ai"]'))
    .click();
  // The OpenAI row reads its own native credentials, not the gate's status.
  await expect(page.getByTestId("openai-credential-state")).toHaveAttribute(
    "data-state",
    /^(signed_in|api_key|missing)$/,
  );
  expect(checks).toBe(0);
  await page.getByTestId("settings-close").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "ordinary-dir",
  );
  expect(checks).toBe(0);
  await expect(page.getByTestId("open-conversations")).toBeVisible();
  await page.setViewportSize({ width: 750, height: 720 });
  await expect(
    page.getByTestId(/^(new-conversation|conversation-start)$/),
  ).toBeVisible();
  await page.getByTestId("open-conversations").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/evidence/conversation-actions-compact.png",
  });
});

test("@browser-conversation steer, follow-up and clear return only removed texts", async ({
  page,
}) => {
  test.setTimeout(60000);
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const editor = page.getByTestId("message-input");
  await editor.fill("hidas päätyö");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(
    page
      .getByTestId("composer-stop")
      .and(page.locator('[data-stop-target="agent"]')),
  ).toBeVisible();
  // Alt+Enter goes once the other way (after the turn); Enter steers.
  await editor.fill("jonoon yksi");
  await editor.press("Alt+Enter");
  await expect(editor).toHaveValue("");
  await editor.fill("ohjaus kaksi");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="steer"]'))
    .click();
  await expect(editor).toHaveValue("");
  const queue = page.getByTestId("composer-queue");
  await expect(queue).toBeVisible();
  await expect(queue.getByRole("listitem")).toHaveCount(2);
  await expect(queue.getByRole("listitem").first()).toContainText(
    "ohjaus kaksi",
  );
  await expect(queue.getByRole("listitem").last()).toContainText("jonoon yksi");
  await page.screenshot({ path: "test-results/queue-before-clear.png" });
  await queue.getByTestId("composer-restore-queue").click();
  await expect(editor).toHaveValue("ohjaus kaksi\n\njonoon yksi");
  await expect(queue).toHaveCount(0);
  await page.screenshot({ path: "test-results/queue-after-clear.png" });
  await expectNativeContent(page, "jonoon yksi", {
    exact: true,
    count: 0,
    visible: false,
  });
});

/** Samples every frame where the person can see a text: the field, Pi's
 * queue card and the conversation. */
async function sampleText(page: import("@playwright/test").Page, text: string) {
  await page.evaluate((t) => {
    const w = window as unknown as {
      samples: { field: boolean; queue: boolean; shown: number }[];
    };
    w.samples = [];
    const tick = () => {
      const field = document.querySelector<HTMLTextAreaElement>(
        '[data-testid="message-input"]',
      );
      w.samples.push({
        field: !!field?.value.includes(t),
        queue: [
          ...document.querySelectorAll('[data-testid="composer-queue"] li'),
        ].some((e) => e.textContent?.includes(t)),
        shown: [
          ...document.querySelectorAll(
            '[data-testid="conversation-timeline"] [data-testid="user-content"]',
          ),
        ].filter((e) => e.textContent?.includes(t)).length,
      });
      requestAnimationFrame(tick);
    };
    tick();
  }, text);
  return async () =>
    (await page.evaluate(
      () => (window as unknown as { samples: unknown[] }).samples,
    )) as { field: boolean; queue: boolean; shown: number }[];
}
test("@browser-conversation a sent message is shown at once and never twice", async ({
  page,
}) => {
  test.setTimeout(60000);
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const editor = page.getByTestId("message-input");
  const send = page.getByTestId("send").and(page.locator('[data-mode="send"]'));
  await editor.fill("ensimmäinen vuoro");
  await send.click();
  await expectNativeContent(page, 'Selvä. Kysyit: "ensimmäinen vuoro".', {
    timeout: 20000,
  });
  // Pi runs and is idle: a direct send. Pi's own record of the message
  // reaches the page only after a debounced invalidation and a history read.
  await editor.fill("toinen vuoro");
  await expect(send).toBeEnabled({ timeout: 20000 });
  const samples = await sampleText(page, "toinen vuoro");
  // Hold every native history read: the message must not wait for one.
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/agents/*/history?*", async (route) => {
    await held;
    await route.continue();
  });
  await send.click();
  try {
    await expect(
      page
        .getByTestId("conversation-timeline")
        .getByTestId("user-content")
        .filter({ hasText: "toinen vuoro" }),
    ).toBeVisible({ timeout: 2000 });
    await expect(editor).toHaveValue("");
  } finally {
    release();
  }
  await expectNativeContent(page, 'Selvä. Kysyit: "toinen vuoro".', {
    timeout: 20000,
  });
  await expect(page.getByTestId("send-pending")).toHaveCount(0);
  const seen = await samples();
  // From the press on, the text is always in view and never in the
  // conversation twice, and it leaves the field for the conversation.
  expect(seen.filter((s) => !s.field && !s.queue && !s.shown)).toEqual([]);
  expect(seen.filter((s) => s.shown > 1)).toEqual([]);
  expect(seen.at(-1)).toEqual({ field: false, queue: false, shown: 1 });
  expect(seen.filter((s) => s.field && s.shown)).toEqual([]);
});
test("@browser-conversation a steering message stays in view until Pi's record shows it", async ({
  page,
}) => {
  test.setTimeout(60000);
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const editor = page.getByTestId("message-input");
  await editor.fill("hidas päätyö");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  const steer = page
    .getByTestId("send")
    .and(page.locator('[data-mode="steer"]'));
  await expect(steer).toBeVisible();
  await editor.fill("ohjaus matkalla");
  const samples = await sampleText(page, "ohjaus matkalla");
  await steer.click();
  // Pi delivers it at its next step; until then it is in Pi's queue card.
  await expectNativeContent(page, 'Selvä. Kysyit: "ohjaus matkalla".', {
    timeout: 30000,
  });
  const seen = await samples();
  expect(seen.filter((s) => !s.field && !s.queue && !s.shown)).toEqual([]);
  expect(seen.filter((s) => s.shown > 1)).toEqual([]);
  expect(seen.at(-1)).toEqual({ field: false, queue: false, shown: 1 });
});
// Jari 31.10.: one Enter on a steer that carried a screenshot showed it twice
// under Odottaa agenttia. Pi queues the text with the host's attachment path
// line, so the page did not recognise its own message in Pi's queue.
test("@browser-conversation one Enter queues a steer with an attachment once", async ({
  page,
}) => {
  test.setTimeout(60000);
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const editor = page.getByTestId("message-input");
  await editor.fill("hidas päätyö");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(
    page.getByTestId("send").and(page.locator('[data-mode="steer"]')),
  ).toBeVisible();
  await editor.evaluate((element) => {
    const data = new DataTransfer();
    data.items.add(
      new File(
        [
          Uint8Array.from(
            atob(
              "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aYioAAAAASUVORK5CYII=",
            ),
            (c) => c.charCodeAt(0),
          ),
        ],
        "kuva.png",
        { type: "image/png" },
      ),
    );
    element.dispatchEvent(
      new ClipboardEvent("paste", {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(
    page.locator(".ah-composer").getByTestId("attachment-chip"),
  ).toHaveCount(1);
  await editor.fill("ohjaus liitteellä");
  const posts: string[] = [];
  page.on("request", (r) => {
    const route = new URL(r.url()).pathname.split("/").at(-1) ?? "";
    if (r.method() === "POST" && ["send", "steer", "follow_up"].includes(route))
      posts.push(route);
  });
  await page.evaluate(() => {
    const w = window as unknown as {
      rows: number[];
      rawReferences: string[];
      thumbnails: number[];
    };
    w.rows = [];
    w.rawReferences = [];
    w.thumbnails = [];
    const tick = () => {
      w.rows.push(
        [
          ...document.querySelectorAll('[data-testid="composer-queue"] li'),
        ].filter((e) => e.textContent?.includes("ohjaus liitteellä")).length,
      );
      const queue = document.querySelector('[data-testid="composer-queue"]');
      if (queue?.textContent?.includes("/api/v1/attachments/"))
        w.rawReferences.push(queue.textContent);
      w.thumbnails.push(
        queue?.querySelectorAll('[data-testid="attachment-chip"] img').length ??
          0,
      );
      requestAnimationFrame(tick);
    };
    tick();
  });
  await editor.press("Enter");
  await expect(editor).toHaveValue("");
  await expectNativeContent(page, /Kysyit: ".*ohjaus liitteellä/, {
    timeout: 30000,
  });
  const rows = await page.evaluate(
    () => (window as unknown as { rows: number[] }).rows,
  );
  expect(rows).toContain(1);
  expect(Math.max(...rows)).toBe(1);
  expect(posts).toEqual(["steer"]);
  const presentation = await page.evaluate(() => {
    const w = window as unknown as {
      rawReferences: string[];
      thumbnails: number[];
    };
    return { rawReferences: w.rawReferences, thumbnails: w.thumbnails };
  });
  expect(presentation.rawReferences).toEqual([]);
  expect(presentation.thumbnails).toContain(1);
});
// Jari 31.10.: a steer pressed as the turn ended was refused (Tila muuttui)
// and the text came back to the field. A steer that finds the agent idle
// starts the next turn instead.
test("@browser-conversation a steer that arrives after the turn ended is sent, not refused", async ({
  page,
}) => {
  test.setTimeout(60000);
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const editor = page.getByTestId("message-input");
  await editor.fill("hidas päätyö");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(
    page.getByTestId("send").and(page.locator('[data-mode="steer"]')),
  ).toBeVisible();
  const id = new URL(page.url()).searchParams.get("conversation") ?? "";
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/conversations/*/steer", async (route) => {
    await held;
    await route.continue();
  });
  await editor.fill("myöhäinen ohjaus");
  await editor.press("Enter");
  await expect(editor).toHaveValue("");
  // The steer reaches the host only after Pi's turn has ended.
  await expect
    .poll(
      async () => {
        const r = await page.request.get(
          `/api/v1/conversations/${id.slice(3)}/status`,
        );
        const status = r.ok() ? await r.json() : {};
        return `${status.state}/${status.run_active}`;
      },
      { timeout: 30000 },
    )
    .toBe("idle/false");
  release();
  await expectNativeContent(page, 'Selvä. Kysyit: "myöhäinen ohjaus".', {
    timeout: 20000,
  });
  await expect(
    page
      .getByTestId("conversation-timeline")
      .getByTestId("user-content")
      .filter({ hasText: "myöhäinen ohjaus" }),
  ).toHaveCount(1);
  await expect(page.getByTestId("message-rejected")).toHaveCount(0);
  await expect(page.getByTestId("send-receipt")).toHaveCount(0);
  await expect(page.getByTestId("composer-queue")).toHaveCount(0);
  await expect(editor).toHaveValue("");
});

test("@browser-conversation a refused or unknown stop says so once and Stop works again", async ({
  page,
}) => {
  test.setTimeout(60000);
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await page.getByTestId("message-input").fill("hidas ei pysähdy");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  const stop = page
    .getByTestId("composer-stop")
    .and(page.locator('[data-stop-target="agent"]'));
  const notice = page.getByTestId("composer-notice");
  await expect(stop).toBeVisible();
  // Pi refuses this abort: the daemon reports the refusal as the abort's
  // acknowledgement, and the turn goes on.
  await stop.click();
  await expect(notice).toHaveAttribute("data-state", "rejected");
  await expect(stop).toBeEnabled();
  // The reply to the next abort is lost: its outcome is unknown.
  await page.route("**/api/v1/conversations/*/abort", (route) =>
    route.abort("failed"),
  );
  await stop.click();
  await expect(notice).toHaveAttribute("data-state", "uncertain");
  // Each outcome is said once, in the composer, not again as a banner.
  await expect(page.getByTestId("send-receipt")).toHaveCount(0);
  await expect(page.getByTestId("conversation-recheck")).toHaveCount(0);
  // The turn ending on its own settles what the stop could not.
  await expect(stop).toHaveCount(0, { timeout: 20000 });
  await expect(notice).toHaveCount(0);
});
test("@browser-conversation a stale working view cannot strand an unsent queued draft", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const editor = page.getByTestId("message-input");
  await editor.fill("hidas päätyö");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(
    page
      .getByTestId("composer-stop")
      .and(page.locator('[data-stop-target="agent"]')),
  ).toBeVisible();
  await editor.fill("ei jonoon");
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const intercepted = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route("**/conversations/*/follow_up", async (route) => {
    started();
    await held;
    await route.continue();
  });
  try {
    await editor.press("Alt+Enter");
    await intercepted;
    // The original turn settles while the browser request is held. A late
    // browser follow-up starts the next turn instead of stranding the draft.
    const agentId = new URL(page.url()).searchParams.get("conversation");
    if (!agentId) throw new Error("missing controlled agent");
    await expect
      .poll(
        async () => {
          const response = await page.request.get(
            `/api/v1/conversations/${agentId.slice(3)}/status`,
          );
          return (await response.json()).state;
        },
        { timeout: 25000 },
      )
      .toBe("idle");
    const answered = page.waitForResponse((response) =>
      response.url().endsWith("/follow_up"),
    );
    release();
    expect((await answered).ok()).toBeTruthy();
    await expectNativeContent(
      page.locator("main"),
      'Selvä. Kysyit: "ei jonoon".',
      {
        timeout: 20000,
      },
    );
    await expect(editor).toHaveValue("");
    await expect(page.getByTestId("send-uncertain")).toHaveCount(0);
  } finally {
    release();
  }
});

test("@browser-conversation warm controlled return reads neither status nor history", async ({
  page,
}) => {
  const allStreams: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/v1/events")
      allStreams.push(request.url());
  });
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await readyConversation(page);
  const firstURL = page.url();
  await page.getByTestId("workspace-ordinary-dir").last().click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await readyConversation(page);
  const secondId = new URL(page.url()).searchParams.get("conversation");
  if (!secondId) throw new Error("missing second conversation");
  // Creation invalidates the native catalog asynchronously. Start a new page
  // from its current snapshot cursor before warming both retained controllers,
  // so those creation events cannot be mistaken for route-caused reads.
  allStreams.length = 0;
  await page.goto(firstURL);
  // The loading view's field is enabled before the conversation has made
  // its first reads; leaving then cuts them short and the return reads again.
  await readyConversation(page);
  await page.getByTestId("workspace-ordinary-dir").last().click();
  // The second window's own first reads (its offers and start page; the
  // workspace list reads neither) can land after its field is enabled. They
  // are not part of the return being measured.
  const mounted = (path: string, query = "") =>
    page
      .waitForRequest((request) => {
        const url = new URL(request.url());
        return url.pathname === path && url.search.includes(query);
      })
      .then((request) => request.response());
  const secondReads = Promise.all([
    mounted("/api/v1/file-offers", secondId.slice(3)),
    mounted("/api/v1/workspaces/start_page"),
  ]);
  await page
    .getByRole("navigation")
    .locator(`a[href*="${secondId.slice(3)}"]`)
    .click();
  await expect(page.getByTestId("message-input")).toBeEnabled();
  await secondReads;
  const requests: string[] = [];
  const controlledRecapReads: string[] = [];
  const streams: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/v1/events") streams.push(request.url());
    if (
      url.pathname.startsWith("/api/v1/") &&
      url.pathname !== "/api/v1/events"
    ) {
      requests.push(url.pathname);
      if (
        url.pathname.endsWith("/recap") &&
        new URL(page.url()).searchParams.has("conversation")
      )
        controlledRecapReads.push(url.pathname);
    }
  });
  expect(streams).toEqual([]); // The initial connection predates the measurement.
  const start = await page.evaluate(() => performance.now());
  await page.goBack(); // workspace
  await page.goBack(); // first controlled window
  await expect(page).toHaveURL(firstURL);
  await expect(page.getByTestId("message-input")).toBeVisible();
  const paint = await page.evaluate(
    () =>
      new Promise<number>((resolve) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => resolve(performance.now())),
        ),
      ),
  );
  // Native default/refusal discovery is new and intentionally fresh when the
  // empty composer mounts (and when crossing the pre-start workspace view).
  // Status, timeline and recap must still stay warm; discovery cannot loop.
  // Native inventory is ephemeral; returning to a retained conversation must
  // refetch it. The workspace's independent recap cards may read once each,
  // but the retained controller's timeline/status/recap must stay warm.
  expect(
    requests.filter(
      (path) =>
        path !== "/api/v1/pi/models" &&
        !path.endsWith("/recap") &&
        !/^\/api\/v1\/agents\/pi:[0-9a-fA-F-]{36}\/spinoffs$/.test(path) &&
        !/\/conversations\/[^/]+\/processes$/.test(path) &&
        // The top bar's shell count and editor choice are independent native
        // observations on mount, not conversation status/history reloads.
        path !== "/api/v1/workspaces/terminals" &&
        path !== "/api/v1/account/preferences" &&
        // The workspace page shows the authored start page (file-only read).
        path !== "/api/v1/workspaces/start_page",
    ),
  ).toEqual([]);
  expect(controlledRecapReads).toEqual([]);
  const cardReads = requests.filter((path) => path.endsWith("/recap"));
  expect(new Set(cardReads).size).toBe(cardReads.length);
  expect(
    requests.filter((path) => path === "/api/v1/pi/models").length,
  ).toBeLessThanOrEqual(2);
  expect(streams).toEqual([]);
  expect(allStreams).toHaveLength(1);
  console.log(
    `warm controlled return: ${Math.round(paint - start)} ms (includes workspace navigation), ${requests.filter((path) => path === "/api/v1/pi/models").length} model discovery reads, ${cardReads.length} workspace recap reads, ${allStreams.length} total SSE, ${streams.length} reopened SSE`,
  );
});

test("@browser-conversation separate streaming drafts survive agent switches and vanish on identity change", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi/);
  const firstURL = page.url();
  const editor = page.getByTestId("message-input");
  await expect(editor).toBeVisible();
  await editor.fill("hidas ensimmäinen vuoro");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(editor).toHaveValue("");
  await editor.fill("ensimmäisen oma luonnos");
  await page.getByTestId("workspace-ordinary-dir").last().click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi/);
  const secondURL = page.url();
  expect(secondURL).not.toBe(firstURL);
  await expect(editor).toHaveValue("");
  await editor.fill("toisen oma luonnos");
  await page.goBack(); // workspace
  await page.goBack(); // first agent, without a document reload
  await expect(page).toHaveURL(firstURL);
  await expect(editor).toHaveValue("ensimmäisen oma luonnos");
  await page.goForward();
  await page.goForward();
  await expect(editor).toHaveValue("toisen oma luonnos");
  await page.reload();
  await expect(editor).toHaveValue("toisen oma luonnos");
  await page.getByTestId("account-menu-trigger").click();
  await page.getByTestId("menu-logout").click();
  await page.getByRole("dialog").getByTestId("logout-confirm").click();
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=43"]')).click();
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter((key) => key.includes(":draft:")),
    ),
  ).toEqual([]);
  await expectNativeContent(page, "toisen oma luonnos", {
    count: 0,
    visible: false,
  });
});

test("@browser-conversation a draft written while the conversation loads goes on from its end", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi/);
  const conversation = page.url();
  // A document load reads the conversation's status cold; holding it keeps
  // the loading view's field up while the person writes.
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/api\/v1\/conversations\/[^/]+\/status/, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto(conversation);
  const editor = page.getByTestId("message-input");
  await editor.fill("Alku");
  release();
  await expect(page.getByTestId("conversation-loading")).toHaveCount(0);
  await expect(editor).toBeFocused();
  // The opened conversation's field takes the focus; the next words, typed
  // or dictated at the caret, follow what was written.
  await page.keyboard.type(" jatkuu");
  await expect(editor).toHaveValue("Alku jatkuu");
});

test("@browser-conversation logout fences a pending status read and turn even when server logout fails", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const editor = page.getByTestId("message-input");
  // Sent from the creation view the message would be held, and the status
  // read held below would keep the conversation from opening.
  await readyConversation(page);
  await editor.fill("turn in progress");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await editor.fill("secret draft");
  const person = await page.evaluate(
    () =>
      Object.keys(sessionStorage)
        .find((key) => key.includes(":draft:"))
        ?.split(":")[1],
  );
  expect(person).toBeTruthy();
  await page.evaluate((identity) => {
    sessionStorage.setItem(`nah:${identity}:last-send:held`, "pending");
  }, person);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route("**/api/v1/conversations/*/status*", async (route) => {
    started();
    await held;
    await route.continue().catch(() => {});
  });
  await page.route("**/auth/logout", (route) => route.fulfill({ status: 503 }));
  try {
    await refreshConversation(page);
    await entered;
    await page.getByTestId("account-menu-trigger").click();
    await page.getByTestId("menu-logout").click();
    await page.getByRole("dialog").getByTestId("logout-confirm").click();
    await expect(page.getByTestId("logout-uncertain")).toBeVisible();
    expect(
      await page.evaluate(
        (identity) =>
          Object.keys(sessionStorage).filter((key) =>
            key.startsWith(`nah:${identity}:`),
          ),
        person,
      ),
    ).toEqual([]);
    release();
    await expectNativeContent(page, "secret draft", {
      count: 0,
      visible: false,
    });
    await page.unroute("**/auth/logout");
    await page.getByTestId("logout-uncertain").getByRole("button").click();
    await expect(page.getByTestId("logout-uncertain")).toHaveCount(0);
    await page.getByTestId("github-sign-in").click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=42"]'))
      .click();
    await expect(page.getByTestId("account-menu-trigger")).toBeVisible();
  } finally {
    release();
  }
});

test("@browser-conversation a late create reply cannot restore a cleared command marker", async ({
  page,
}) => {
  await open(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route("**/api/v1/conversations", async (route) => {
    started();
    await held;
    await route.continue().catch(() => {});
  });
  try {
    await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
    await entered;
    const person = await page.evaluate(
      () =>
        Object.keys(sessionStorage)
          .find((key) => key.includes(":uncertain:"))
          ?.split(":")[1],
    );
    expect(person).toBeTruthy();
    await page.getByTestId("account-menu-trigger").click();
    await page.getByTestId("menu-logout").click();
    await page.getByRole("dialog").getByTestId("logout-confirm").click();
    await expect(page.getByTestId("github-sign-in")).toBeVisible();
    release();
    expect(
      await page.evaluate(
        (identity) =>
          Object.keys(sessionStorage).filter((key) =>
            key.startsWith(`nah:${identity}:`),
          ),
        person,
      ),
    ).toEqual([]);
    await page.getByTestId("github-sign-in").click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=43"]'))
      .click();
    await expect(page.getByTestId("account-menu-trigger")).toBeVisible();
    expect(
      await page.evaluate(
        (identity) =>
          Object.keys(sessionStorage).filter((key) =>
            key.startsWith(`nah:${identity}:`),
          ),
        person,
      ),
    ).toEqual([]);
  } finally {
    release();
  }
});

test("@browser-conversation expiry clears drafts and pending markers before same-person sign-in", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const editor = page.getByTestId("message-input");
  await expect(editor).toBeVisible();
  await editor.fill("not for the next session");
  const person = await page.evaluate(
    () =>
      Object.keys(sessionStorage)
        .find((key) => key.includes(":draft:"))
        ?.split(":")[1],
  );
  expect(person).toBeTruthy();
  await page.evaluate((identity) => {
    sessionStorage.setItem(`nah:${identity}:uncertain:held`, "pending");
  }, person);
  expect((await page.request.get("/fixture/expire")).status()).toBe(204);
  // Expiry may reach the UI through the journal before the details control
  // can be clicked. Reload forces a session read in either state.
  await page.reload();
  await expect(page.getByTestId("github-sign-in")).toBeVisible();
  expect(
    await page.evaluate(
      (identity) =>
        Object.keys(sessionStorage).filter((key) =>
          key.startsWith(`nah:${identity}:`),
        ),
      person,
    ),
  ).toEqual([]);
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.getByTestId("account-menu-trigger")).toBeVisible();
  await expectNativeContent(page, "not for the next session", {
    count: 0,
    visible: false,
  });
});

test("@browser-conversation expiry across reload clears unknown prior person's drafts", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const editor = page.getByTestId("message-input");
  await expect(editor).toBeVisible();
  await editor.fill("private across reload");
  const person = await page.evaluate(
    () =>
      Object.keys(sessionStorage)
        .find((key) => key.includes(":draft:"))
        ?.split(":")[1],
  );
  expect(person).toBeTruthy();
  await page.evaluate((identity) => {
    sessionStorage.setItem(`nah:${identity}:last-send:held`, "pending");
    sessionStorage.setItem("nah:github-step", "global");
    sessionStorage.setItem("__oh_test_reload_seed", "1");
  }, person);
  // Re-seed once before the new App loads: the previous document may already
  // have seen a 401 from its stream, which would otherwise make this pass by luck.
  await page.addInitScript((identity) => {
    if (sessionStorage.getItem("__oh_test_reload_seed") !== "1") return;
    sessionStorage.removeItem("__oh_test_reload_seed");
    sessionStorage.setItem(
      `nah:${identity}:draft:held`,
      "private across reload",
    );
    sessionStorage.setItem(`nah:${identity}:last-send:held`, "pending");
  }, person);
  expect((await page.request.get("/fixture/expire")).status()).toBe(204);
  await page.reload();
  await expect(page.getByTestId("github-sign-in")).toBeVisible();
  expect(
    await page.evaluate(
      (identity) =>
        Object.keys(sessionStorage).filter((key) =>
          key.startsWith(`nah:${identity}:`),
        ),
      person,
    ),
  ).toEqual([]);
  expect(
    await page.evaluate(() => sessionStorage.getItem("nah:github-step")),
  ).toBe("global");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=43"]')).click();
  await expect(page.getByTestId("account-menu-trigger")).toBeVisible();
  await expectNativeContent(page, "private across reload", {
    count: 0,
    visible: false,
  });
});

async function stoppedConversation(page: import("@playwright/test").Page) {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi/);
  const id = new URL(page.url()).searchParams.get("conversation");
  if (!id) throw new Error("missing conversation");
  const editor = page.getByTestId("message-input");
  await editor.fill("synthetic end then continue");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect
    .poll(async () => {
      const r = await page.request.get(
        `/api/v1/conversations/${id.slice(3)}/status`,
      );
      const s = await r.json();
      return s.state === "idle" && s.native_history === "present";
    })
    .toBe(true);
  // The host can settle before the event stream delivers the send receipt to
  // the browser. Stopping Pi before that delivery would correctly leave the
  // browser uncertain, not ready for this helper's continuation assertion.
  await expectNativeContent(
    page,
    'Selvä. Kysyit: "synthetic end then continue".',
    {},
  );
  await expect(editor).toBeEnabled();
  const { csrf } = await (await page.request.get("/auth/session")).json();
  const stopped = await page.request.post(
    `/api/v1/conversations/${id.slice(3)}/stop`,
    {
      headers: { "X-Agent-Host-CSRF": csrf, Origin: host },
    },
  );
  expect(stopped.status()).toBe(200);
  await refreshConversation(page);
  // A conversation without a running Pi stays writable: no read-only state
  // and no explicit continuation. Pi starts again only on the next send.
  await expect
    .poll(async () => {
      const r = await page.request.get(
        `/api/v1/conversations/${id.slice(3)}/status`,
      );
      return (await r.json()).state;
    })
    .toBe("stopped");
  await refreshConversation(page);
  await expect(page.getByTestId("continue-conversation")).toHaveCount(0);
  await expect(editor).toBeEnabled();
  return id;
}

test("@browser-conversation idle controlled Pi can archive without stopping its child", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const editor = page.getByTestId("message-input");
  await readyConversation(page);
  await editor.fill("idle archive proof");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  const id = new URL(page.url()).searchParams.get("conversation");
  await expect
    .poll(async () => {
      const reply = await page.request.get(
        `/api/v1/conversations/${id?.slice(3)}/status`,
      );
      const state = await reply.json();
      return state.state === "idle" && state.native_history === "present";
    })
    .toBe(true);
  await refreshConversation(page);
  const archive = page
    .locator(".ah-agent-header")
    .getByTestId("archive-conversation")
    .and(page.locator(':not([data-archive-state="archived"])'));
  await expect(archive).toBeEnabled();
  await archive.click();
  await expect(page).toHaveURL(/\/workspaces\/[^?]+$/);
});

test("@browser-conversation phone archives directly into its workspace", async ({
  page,
}) => {
  const id = await stoppedConversation(page);
  await page.setViewportSize({ width: 390, height: 844 });
  // On a phone the archive action is in the conversation's menu.
  await page.getByTestId("conversation-menu").click();
  await page
    .getByRole("menuitem")
    .and(page.getByTestId("menu-archive"))
    .click();
  await expect(page.getByTestId("archive-confirmation")).toHaveCount(0);
  await expect(page).toHaveURL(/\/workspaces\/[^?]+$/);
  await page.locator(".ah-workspace-archive > summary").click();
  await expect(page.getByTestId("workspace-archive-panel")).toContainText(
    "synthetic end then continue",
  );
  await page.goto(`/agents/${id}`);
  await expect(
    page
      .getByTestId("restore-conversation")
      .or(
        page
          .getByTestId("archive-conversation")
          .and(page.locator('[data-archive-state="archived"]')),
      ),
  ).toBeEnabled();
});

test("@browser-conversation restart replaces an in-place running turn with native history", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  // The reload below must find the created conversation, not the creation
  // view a slow host still shows.
  await readyConversation(page);
  const editor = page.getByTestId("message-input");
  await editor.fill("native reply before restart");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expectNativeContent(
    page.getByTestId("conversation-timeline"),
    "native reply before restart",
    { exact: true },
  );
  // The tab must know the send's outcome before the restart: a restart that
  // takes the only record of it leaves it unknown, and an unknown send keeps
  // the controlled view (a receipt lost on daemon restart remains unknown).
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(sessionStorage).some((key) => key.includes(":last-send:")),
      ),
    )
    .toBe(false);
  // Reload the controlled view with its native history, but prevent the old
  // stream from issuing a status event when the fixture replaces the daemon.
  await page.route("**/api/v1/events*", (route) => route.abort("failed"));
  await page.reload();
  await expect(editor).toBeVisible();
  let releaseStatus!: () => void;
  const heldStatus = new Promise<void>((resolve) => {
    releaseStatus = resolve;
  });
  await page.route("**/api/v1/conversations/*/status*", async (route) => {
    await heldStatus;
    await route.fulfill({ status: 404 });
  });
  try {
    expect(
      (await page.request.get("/fixture/conversations-reset")).status(),
    ).toBe(204);
    const snapshotRead = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/v1/snapshot" &&
        response.ok(),
    );
    await page.getByTestId("snapshot-refresh").click();
    await snapshotRead;
    await expect(page.getByTestId("conversation-stale")).toBeVisible();
    await expect(page).toHaveURL(/conversation=pi:/);
    releaseStatus();
    await expect(page).toHaveURL(/\/agents\/pi:/);
    await expect(page.locator(".ah-agent-header")).toHaveAttribute(
      "data-control",
      "read-only",
    );
  } finally {
    releaseStatus();
  }
  await expect(editor).toHaveCount(0);
  await expect(page.getByTestId("continue-conversation")).toHaveCount(0);
  await expectNativeContent(
    page.getByTestId("conversation-timeline"),
    "native reply before restart",
    { exact: true },
  );
});

test("@browser-conversation restart keeps a browser conversation writable and archivable without a handle", async ({
  page,
}) => {
  test.setTimeout(60000);
  const id = await stoppedConversation(page);
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
  // An old read-only link opens the conversation itself, with its composer.
  await page.goto(`/agents/${id}`);
  await expect(page).toHaveURL(new RegExp(`conversation=${id}`));
  const bar = page.locator(".ah-agent-header");
  const editor = page.getByTestId("message-input");
  await expect(editor).toBeEnabled();
  await expect(bar).not.toHaveAttribute("data-control", "read-only");
  await expect(
    bar
      .getByTestId("archive-conversation")
      .and(page.locator(':not([data-archive-state="archived"])')),
  ).toBeEnabled();
  // A document load cancels a write still on its way: wait for its answer.
  const archived = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/workspaces" &&
      response.request().method() !== "GET",
  );
  await bar
    .getByTestId("archive-conversation")
    .and(page.locator(':not([data-archive-state="archived"])'))
    .click();
  expect((await archived).ok()).toBe(true);
  await page.goto(`/agents/${id}`);
  const restore = bar
    .getByTestId("restore-conversation")
    .or(
      bar
        .getByTestId("archive-conversation")
        .and(page.locator('[data-archive-state="archived"]')),
    );
  await expect(restore).toBeEnabled();
  expect(
    (await new AxeBuilder({ page }).include(".ah-agent-header").analyze())
      .violations,
  ).toEqual([]);
  await restore.click();
  // Visible again, the conversation returns to its composer; nothing started Pi.
  await expect(page).toHaveURL(new RegExp(`conversation=${id}`));
  await expect(editor).toBeEnabled();
  await expect(page.getByTestId("continue-conversation")).toHaveCount(0);
  const status = await page.request.get(
    `/api/v1/conversations/${id.slice(3)}/status`,
  );
  expect((await status.json()).state).toBe("stopped");
});

test("@browser-conversation a turn stopped in a restored conversation ends calmly and stays marked", async ({
  page,
}) => {
  test.setTimeout(90000);
  const id = await stoppedConversation(page);
  const bar = page.locator(".ah-agent-header");
  await archiveFromConfirmedView(page, () =>
    bar
      .getByTestId("archive-conversation")
      .and(page.locator(':not([data-archive-state="archived"])')),
  );
  await page.goto(`/agents/${id}`);
  await bar
    .getByTestId("restore-conversation")
    .or(
      bar
        .getByTestId("archive-conversation")
        .and(page.locator('[data-archive-state="archived"]')),
    )
    .click();
  await expect(page).toHaveURL(new RegExp(`conversation=${id}`));
  // The restored conversation's Pi is not running: this send is held by the
  // daemon and starts Pi, unlike a stop in a conversation whose Pi runs.
  const editor = page.getByTestId("message-input");
  await expect(editor).toBeEnabled();
  await page.request.get("/fixture/scenario?value=pi-visual-hold");
  await editor.fill("hidas jatko");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  // Stop while the tool runs: Pi has saved its call and not yet its result.
  await expect
    .poll(
      async () => {
        const response = await page.request.get(`/api/v1/agents/${id}/history`);
        if (!response.ok()) return false;
        const last = (await response.json()).entries?.at(-1) as
          | { kind: string; blocks?: { type: string }[] }
          | undefined;
        return (
          last?.kind === "assistant" &&
          !!last.blocks?.some((block) => block.type === "toolCall")
        );
      },
      { timeout: 20000, intervals: [100] },
    )
    .toBe(true);
  // Open the work, so a state inside the turn would be seen too.
  await page.getByTestId("turn-work-toggle").click();
  await recordStopStates(page);
  const stop = page
    .getByTestId("composer-stop")
    .and(page.locator('[data-stop-target="agent"]'));
  await stop.click();
  await expect(stop).toHaveCount(0);
  // Late status and history reads must not bring a warning back either.
  await page.waitForTimeout(1500);
  expect(
    (await stopStates(page)).filter(
      (s) => s.banner || s.recheck || s.uncertain || s.liveNotice,
    ),
  ).toEqual([]);
  const turn = page.getByTestId("agent-turn").last();
  await expect(turn.getByTestId("turn-stopped")).toBeVisible();
  // The person stopped the command; it did not fail.
  await expect(turn.getByTestId("turn-failures")).toHaveCount(0);
  await expect(
    turn.getByTestId("tool-row").and(page.locator('[data-state="failed"]')),
  ).toHaveCount(0);
  // The mark comes from native history, so a reload still shows it on the
  // stopped turn and on no other.
  await page.reload();
  await expect(page.getByTestId("agent-turn")).toHaveCount(2);
  await expect(page.getByTestId("turn-stopped")).toHaveCount(1);
  await expect(
    page.getByTestId("agent-turn").last().getByTestId("turn-stopped"),
  ).toBeVisible();
});

test("@browser-conversation missing archive history never appears as a confirmed empty archive", async ({
  page,
}) => {
  await open(page);
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.sources.find(
      (fact: { source: string }) => fact.source === "pi_history",
    ).state = "unknown";
    body.agents = [];
    await route.fulfill({ response, json: body });
  });
  await page.reload();
  await page.locator(".ah-workspace-archive > summary").click();
  await expect(page.getByTestId("workspace-archive-panel")).toBeVisible();
  await page.getByTestId("home-link").filter({ visible: true }).click();
  await expect(page.getByTestId("archive-incomplete")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.sources.find(
      (f: { source: string }) => f.source === "annotation",
    ).state = "unavailable";
    body.sources.find(
      (f: { source: string }) => f.source === "pi_history",
    ).state = "confirmed";
    await route.fulfill({ response, json: body });
  });
  await page.reload();
  await expect(
    page.getByTestId("archive-incomplete").locator(".."),
  ).toHaveAttribute("data-annotation-state", "unavailable");
});

test("@browser-conversation archive restore makes a stopped conversation writable again", async ({
  page,
}) => {
  const id = await stoppedConversation(page);
  await archiveFromConfirmedView(page, () =>
    page
      .getByTestId("archive-conversation")
      .and(page.locator(':not([data-archive-state="archived"])')),
  );
  await page.getByTestId("home-link").filter({ visible: true }).click();
  await expect(
    await nativeConversationLink(
      page,
      page.getByRole("navigation"),
      "synthetic end then continue",
    ),
  ).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  const workspaceURL = page.url();
  await page.locator(".ah-workspace-archive > summary").click();
  const archive = page.getByTestId("workspace-archive-panel");
  await expect(archive).toContainText("synthetic end then continue");
  await archive
    .getByTestId("restore-conversation")
    .or(
      archive
        .getByTestId("archive-conversation")
        .and(page.locator('[data-archive-state="archived"]')),
    )
    .click();
  await expect(
    archive
      .getByTestId("restore-conversation")
      .or(
        archive
          .getByTestId("archive-conversation")
          .and(page.locator('[data-archive-state="archived"]')),
      ),
  ).toHaveCount(0);
  await page.goto(`${workspaceURL}?conversation=${id}`);
  await expect(page.getByTestId("message-input")).toBeEnabled();
  expect(new URL(page.url()).searchParams.get("conversation")).toBe(id);
});

test("@browser-conversation model authentication error offers sign-in without leaking provider text", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page.getByTestId("message-input")).toBeVisible();
  await page.request.get("/fixture/scenario?value=pi-auth-failure");
  await page.getByTestId("message-input").fill("kokeilu");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  const warning = page.getByTestId("ai-sign-in-warning");
  await expect(warning).toHaveAttribute("data-state", "openai-codex");
  expect(await page.locator("main").innerText()).not.toContain(
    "synthetic-secret",
  );
  // The refused message waits in the field; an edit goes as edited.
  await expect(page.getByTestId("message-input")).toHaveValue("kokeilu");
  await page.getByTestId("message-input").fill("säilyvä luonnos");
  const conversationURL = page.url();
  await page.request.get("/fixture/scenario?value=ready");
  await page.request.get("/fixture/pi-state?value=usable");
  await warning.getByRole("button").click();
  const window = page.getByTestId("sign-in-window");
  await expect(window).toHaveAttribute("data-state", "openai-codex");
  await expect(window).toHaveCount(0, { timeout: 12000 });
  expect(page.url()).toBe(conversationURL);
  await expectNativeContent(page, 'Kysyit: "säilyvä luonnos"');
  await expect(page.getByTestId("message-input")).toHaveValue("");
  await expect(warning).toHaveCount(0);
});

test("@browser-conversation unsupported account model is not mistaken for expired login", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await page.request.get("/fixture/scenario?value=pi-model-unsupported");
  await page.getByTestId("message-input").fill("kokeilu");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(page.getByTestId("model-unavailable")).toBeVisible();
  await expect(
    page.getByTestId("provider-auth-error").getByRole("button"),
  ).toHaveCount(0);
  await page.getByTestId("model-unavailable").getByRole("button").click();
  const picker = page.locator(".ah-actionable-notices .ah-pi-model-selector");
  await picker.getByTestId("model-gpt-6-astra").check();
  await page.request.get("/fixture/scenario?value=ready");
  const oldURL = page.url();
  await picker.getByTestId(/^(model-commit|conversation-model-start)$/).click();
  await expect(page).not.toHaveURL(oldURL);
  await expect(page.getByTestId("message-input")).toHaveValue("");
  expect(
    (await (await page.request.get("/api/v1/pi/models")).json()).default_model,
  ).toBe("gpt-6-astra");
  await page.getByTestId("message-input").fill("uusi malli");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expectNativeContent(
    page.getByTestId("conversation-timeline"),
    "uusi malli",
    {},
  );
  await expect(page.locator(".ah-agent-header .ah-set-chip")).toHaveAttribute(
    "data-model",
    /(?:^|\/)gpt-6-astra$/,
  );
  expect(await page.locator("main").innerText()).not.toContain(
    "synthetic-secret",
  );
});

test("@browser-conversation cold open waits for status before reading history", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi:/);
  await expect(page.getByTestId("message-input")).toBeEnabled();
  let releaseStatus!: () => void;
  const statusHold = new Promise<void>((resolve) => {
    releaseStatus = resolve;
  });
  let historyReads = 0;
  let nativeHistory: string | undefined;
  await page.route("**/api/v1/conversations/*/status*", async (route) => {
    await statusHold;
    const response = await route.fetch();
    if (response.ok()) nativeHistory = (await response.json()).native_history;
    await route.fulfill({ response });
  });
  page.on("request", (request) => {
    if (/\/api\/v1\/agents\/pi:.*\/history/.test(request.url())) historyReads++;
  });
  try {
    // Creation is a warm optimistic view. Reload the established route so
    // this really exercises a cold open rather than racing the create reply.
    await page.reload();
    await expect(page.getByTestId("conversation-loading")).toBeVisible();
    expect(historyReads).toBe(0);
    releaseStatus();
    await expect(page.getByTestId("message-input")).toBeEnabled();
    // The composer may enable before the released reply has passed this
    // handler; that reply must still arrive.
    await expect.poll(() => nativeHistory).toMatch(/^(missing|present)$/);
  } finally {
    releaseStatus();
  }
});

test("@browser-conversation idle tab and return do not reread session or status", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page.getByTestId("message-input")).toBeVisible();
  await page.waitForTimeout(1000); // let the opening invalidation settle
  await page.clock.install();
  const counts = { session: 0, status: 0, snapshot: 0, events: 0 };
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path === "/auth/session") counts.session++;
    else if (path.endsWith("/status") && path.includes("/conversations/"))
      counts.status++;
    else if (path === "/api/v1/snapshot") counts.snapshot++;
    else if (path === "/api/v1/events") counts.events++;
  });
  await page.evaluate(() => {
    window.dispatchEvent(new Event("blur"));
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
  });
  await page.clock.fastForward(60_000);
  expect(counts).toEqual({ session: 0, status: 0, snapshot: 0, events: 0 });
  expect(await page.locator(".ah-identity-check").count()).toBe(0);
});

test("@browser-conversation snapshot transport failure leaves editor mounted and retry works", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const editor = page.getByTestId("message-input");
  await expect(editor).toBeVisible();
  await editor.fill("säilyvä luonnos");
  // The host is down for both reads; with the event stream open a failed
  // snapshot read alone is not an outage. Refresh reopens the stream.
  await page.route("**/api/v1/events*", (route) => route.abort());
  await page.route("**/api/v1/snapshot", (route) =>
    route.fulfill({ status: 503, body: "offline" }),
  );
  await page.getByTestId("snapshot-refresh").click();
  await expect(
    page.locator('[data-testid^="connection-"][data-state]'),
  ).toBeVisible();
  await expect(editor).toHaveValue("säilyvä luonnos");
  await page.unroute("**/api/v1/events*");
  await page.unroute("**/api/v1/snapshot");
  await page.getByTestId("connection-retry").click();
  await expect(
    page.locator('[data-testid^="connection-"][data-state]'),
  ).toHaveCount(0);
  await expect(editor).toHaveValue("säilyvä luonnos");
});

test("@browser-conversation 401 from actual status request opens login", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  // Arm at the explicit check: an opening/background read must not log out
  // the page before the action this journey is supposed to exercise.
  await refreshConversation(page, () =>
    page.route("**/api/v1/conversations/*/status*", (route) =>
      route.fulfill({ status: 401, body: "unauthorized" }),
    ),
  );
  await expect(page.getByTestId("github-sign-in")).toBeVisible();
});

test("@browser-conversation changed snapshot identity discards late previous status", async ({
  page,
  context,
}) => {
  // This journey deliberately holds the old status until the manual snapshot
  // observes Bob. Independent native inventories must not win that race by
  // correctly observing the temporary logged-out cookie in the other tab.
  // Keep journal expiry out of this snapshot-identity race. The separate
  // @stream-revocation journey proves that logout closes a real live stream.
  await page.route("**/api/v1/events*", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: ": snapshot identity test\n\n",
    }),
  );
  await page.route("**/api/v1/agents/pi:*/spinoffs", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        parent_id: new URL(route.request().url()).pathname
          .split("/agents/")[1]
          .split("/spinoffs")[0],
        availability: "unavailable",
        runs: [],
        transcripts: [],
      },
    }),
  );
  await page.route("**/api/v1/conversations/*/processes", (route) =>
    route.fulfill({
      json: {
        schema_version: 1,
        owner_generation: null,
        availability: "unavailable",
        unavailable_reason: "extension_missing",
        processes: [],
        interrupted: [],
      },
    }),
  );
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page.getByTestId("message-input")).toBeEnabled();
  await readyConversation(page);
  const check = page.getByTestId("conversation-recheck");
  await page
    .getByRole("button")
    .and(page.getByTestId("workspace-details"))
    .click();
  await expect(check).toBeVisible();
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route("**/api/v1/conversations/*/status*", async (route) => {
    started();
    await held;
    await route.continue().catch(() => {});
  });
  const other = await context.newPage();
  try {
    await check.click();
    await entered;
    await other.goto("/workspaces");
    await other.getByTestId("account-menu-trigger").click();
    await other.getByTestId("menu-logout").click();
    await other.getByRole("dialog").getByTestId("logout-confirm").click();
    await other.getByTestId("github-sign-in").click();
    await other
      .getByRole("link")
      .and(other.locator('a[href*="code=43"]'))
      .click();
    let sessionReads = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/auth/session") sessionReads++;
    });
    await page.getByTestId("snapshot-refresh").click();
    await expect(page.getByTestId("conversation-observation")).toBeVisible();
    await expect.poll(() => sessionReads).toBeGreaterThan(0);
    release();
    await expect(page.getByTestId("message-input")).toHaveCount(0);
  } finally {
    release();
    await other.close();
  }
});

test("@browser-conversation a lost accepted send resolves on reload without another write", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const editor = page.getByTestId("message-input");
  // Sent from the creation view the message would be held instead.
  await readyConversation(page);
  let sends = 0;
  // Fail observation only after the deliberate write. An earlier background
  // status read must not disable the composer before this test can send.
  await page.route("**/api/v1/conversations/*/status", (route) =>
    sends ? route.fulfill({ status: 503 }) : route.continue(),
  );
  await page.route("**/api/v1/conversations/*/send", async (route) => {
    sends++;
    const response = await route.fetch(); // daemon accepted, only browser reply lost
    expect(response.status()).toBe(200);
    await route.abort("failed");
  });
  await editor.fill("only once");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  // Failed observation takes precedence over the send-only warning.
  await expect(page.getByTestId("conversation-stale")).toBeVisible();
  await expect(editor).toHaveValue("only once");
  await expect(
    page.getByTestId("send").and(page.locator('[data-mode="send"]')),
  ).toBeDisabled();
  await page.unroute("**/api/v1/conversations/*/status");
  await page.reload();
  await expect(editor).toBeVisible();
  await expect(editor).toHaveValue("");
  await editor.fill("next deliberate message");
  await expect(
    page.getByTestId("send").and(page.locator('[data-mode="send"]')),
  ).toBeEnabled();
  expect(sends).toBe(1);
});

// Jari 30.10.: renamed from the rail, then sent at once. The daemon got the
// send twice, 4.5 s apart, with no input between; the second was refused and
// the page showed the delivered message as rejected and put it back in the
// field. The same request arriving again is the case reproduced here.
test("@browser-conversation a send that arrives twice is delivered once and never refused", async ({
  page,
}) => {
  test.setTimeout(60000);
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const editor = page.getByTestId("message-input");
  const send = page.getByTestId("send").and(page.locator('[data-mode="send"]'));
  await editor.fill("ensimmäinen vuoro");
  await send.click();
  await expectNativeContent(page, 'Selvä. Kysyit: "ensimmäinen vuoro".', {
    timeout: 20000,
  });
  // The finished conversation is no longer in the rail
  // (rail-running-after-done); the header renames it the same way.
  await page.getByTestId("conversation-rename").click();
  const name = page.getByTestId("conversation-name-field");
  await name.fill("Testinimi 2");
  await name.press("Enter");
  await expect(name).toHaveCount(0);

  const statuses: number[] = [];
  await page.route("**/api/v1/conversations/*/send", async (route) => {
    // The daemon takes the message; its reply is lost and the same request
    // arrives again, as a browser or proxy resends it.
    statuses.push((await route.fetch()).status());
    const again = await route.fetch();
    statuses.push(again.status());
    await route.fulfill({ response: again });
  });
  await editor.click();
  await editor.fill("KAikki noi toimii");
  await expect(send).toBeEnabled({ timeout: 20000 });
  await editor.press("Enter");
  await expectNativeContent(page, 'Selvä. Kysyit: "KAikki noi toimii".', {
    timeout: 20000,
  });
  await expect(
    page
      .getByTestId("conversation-timeline")
      .getByTestId("user-content")
      .filter({ hasText: "KAikki noi toimii" }),
  ).toHaveCount(1);
  await expect(page.getByTestId("message-rejected")).toHaveCount(0);
  await expect(editor).toHaveValue("");
  expect(statuses).toEqual([200, 200]);
});

test("@browser-conversation queue-clear 401 reaches login", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const editor = page.getByTestId("message-input");
  await expect(editor).toBeVisible();
  await editor.fill("hidas päätyö");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(
    page
      .getByTestId("composer-stop")
      .and(page.locator('[data-stop-target="agent"]')),
  ).toBeVisible();
  await editor.fill("jonoon");
  await editor.press("Alt+Enter");
  await expect(page.getByTestId("composer-restore-queue")).toBeVisible();
  // A successful snapshot already in flight must not restore the old view
  // after the actual queue write reports an expired session.
  let release!: () => void;
  let started!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const intercepted = new Promise<void>((resolve) => {
    started = resolve;
  });
  let finish!: (outcome: "delivered" | "cancelled" | Error) => void;
  const finished = new Promise<"delivered" | "cancelled" | Error>((resolve) => {
    finish = resolve;
  });
  let signedOut = false;
  let routeStarted = false;
  await page.route("**/api/v1/snapshot", async (route) => {
    routeStarted = true;
    try {
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      started();
      await held;
      await route.fulfill({ response });
      finish("delivered");
    } catch (error) {
      started(); // Also unblock the test if the upstream snapshot fetch failed.
      // Navigation on expiry may auto-handle an intercepted request. Only that
      // specific cancellation *after* login is expected; surface every other
      // route/fetch failure rather than hiding it during fixture teardown.
      if (
        signedOut &&
        error instanceof Error &&
        /Route is already handled!/.test(error.message)
      ) {
        finish("cancelled");
      } else {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    }
  });
  let routeOutcome: "delivered" | "cancelled" | Error | undefined;
  try {
    await page.getByTestId("snapshot-refresh").click();
    await intercepted;
    await page.route("**/api/v1/conversations/*/clear_queue", (route) =>
      route.fulfill({ status: 401 }),
    );
    await page.getByTestId("composer-restore-queue").click();
    await expect(page.getByTestId("github-sign-in")).toBeVisible();
    signedOut = true;
    release();
    routeOutcome = await finished;
    if (routeOutcome instanceof Error) throw routeOutcome;
    // If navigation cancelled the old response there is nothing to deliver;
    // otherwise the late successful snapshot must not resurrect the session.
    await expect(page.getByTestId("github-sign-in")).toBeVisible();
    await expect(editor).toHaveCount(0);
  } finally {
    release();
    // Wait for the specific handler, not all routes on the page. Never dispose
    // its fetched response while it is still in flight.
    if (routeStarted) routeOutcome = await finished;
    await page.unrouteAll({ behavior: "wait" });
  }
  if (routeOutcome instanceof Error) throw routeOutcome;
});

test("@browser-conversation cursor 409 resnapshots before reopening at the current cursor", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  // The tab-wide stream stays active when returning to the catalog.
  await page.getByTestId("home-link").filter({ visible: true }).click();
  let streams = 0;
  let snapshots = 0;
  let snapshotsAtReconnect = 0;
  await page.route("**/api/v1/snapshot", (route) => {
    snapshots++;
    return route.continue();
  });
  await page.route("**/api/v1/events?after=*", (route) => {
    streams++;
    if (streams <= 2)
      return route.fulfill({ status: 409, body: "cursor_expired" });
    snapshotsAtReconnect = snapshots;
    return route.continue();
  });
  const reopened = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/events" &&
      response.request().resourceType() === "eventsource" &&
      response.ok(),
  );
  await page.reload();
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect.poll(() => snapshots, { timeout: 10000 }).toBeGreaterThan(1);
  await reopened;
  expect(streams).toBe(3); // First EventSource and probe refused; replay now resumes.
  expect(snapshotsAtReconnect).toBeGreaterThan(1);
  await expect(
    page.locator('[data-testid^="connection-"][data-state]'),
  ).toHaveCount(0);
});

test("@browser-conversation lost accepted reply recovers on HTTP snapshot without an event", async ({
  page,
}) => {
  // Keep SSE unavailable during the lost receipt and freeze scheduled
  // retries: the HTTP snapshot must initiate the check on its own. Let the
  // initial conversation become writable through HTTP, with no SSE stream
  // established: routing later would leave an existing EventSource connected.
  await page.route("**/api/v1/events?after=*", (route) => route.abort());
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const editor = page.getByTestId("message-input");
  await readyConversation(page);
  await page.clock.pauseAt(new Date());
  let sends = 0;
  await page.route("**/api/v1/conversations/*/send", async (route) => {
    sends++;
    const reply = await route.fetch();
    expect(reply.status()).toBe(200);
    await route.abort("failed");
  });
  // Background recovery may already be reading: do not make the composer
  // unavailable before the deliberate send crosses the write boundary.
  for (const path of [
    "conversations/*/status",
    "conversations/*/receipt?command_id=*",
    "snapshot",
  ]) {
    await page.route(`**/api/v1/${path}`, async (route) => {
      if (sends) return route.abort();
      const response = await route.fetch();
      // A read begun before the send may still observe its acceptance.
      return sends ? route.abort() : route.fulfill({ response });
    });
  }
  await editor.fill("original message");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect.poll(() => sends).toBe(1);
  // With both transports unavailable, the connection warning takes
  // precedence over the send-only warning.
  await page.getByTestId("snapshot-refresh").click();
  await expect(
    page.locator('[data-testid^="connection-"][data-state]'),
  ).toBeVisible();
  await expect(
    page.getByTestId("send").and(page.locator('[data-mode="send"]')),
  ).toBeDisabled();
  await expect(editor).toHaveValue("original message");
  await page.unroute("**/api/v1/conversations/*/status");
  await page.unroute("**/api/v1/conversations/*/receipt?command_id=*");
  await page.unroute("**/api/v1/snapshot");
  await page.getByTestId("connection-retry").click();
  await expect(page.getByTestId("send-uncertain")).toHaveCount(0);
  await expect(editor).toHaveValue("");
  // The recovered message is Pi's running turn, and on a loaded host it may
  // still run when the snapshot is read. Only events and the unfrozen clock
  // tell the page that it ended, so restore both before the next message.
  await page.unroute("**/api/v1/events?after=*");
  await page.clock.resume();
  await editor.fill("next deliberate message");
  await expect(
    page.getByTestId("send").and(page.locator('[data-mode="send"]')),
  ).toBeEnabled({ timeout: 30_000 });
  expect(sends).toBe(1);
});

test("@browser-conversation a receipt lost on daemon restart remains unknown", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const editor = page.getByTestId("message-input");
  // Sent from the creation view the message would be held instead.
  await readyConversation(page);
  let sends = 0;
  await page.route("**/api/v1/conversations/*/send", async (route) => {
    sends++;
    await route.abort("failed");
  });
  await page.route("**/api/v1/conversations/*/status", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.command_id = "";
    body.ack = "";
    body.send_receipt = "";
    await route.fulfill({ response, json: body });
  });
  let lookups = 0;
  await page.route(
    "**/api/v1/conversations/*/receipt?command_id=*",
    (route) => {
      lookups++;
      return route.fulfill({ status: 404 });
    },
  );
  await editor.fill("unknown message");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(page.getByTestId("send-uncertain")).toBeVisible();
  await expect.poll(() => lookups).toBeGreaterThan(0);
  await page.getByTestId("snapshot-refresh").click();
  await expect.poll(() => lookups).toBeGreaterThan(1);
  await expect(page.locator(".ah-send-rejected")).toHaveCount(0);
  await expect(
    page.getByTestId("send").and(page.locator('[data-mode="send"]')),
  ).toBeDisabled();
  await expect(editor).toHaveValue("unknown message");
  expect(sends).toBe(1);
});

// Jari 8.11.2026 (pilot.648): a message sent while the test server restarted
// reached Pi, which answered it, yet the page drew it again as uncertain under
// Pi's own message, with three notices saying so. A restarted daemon has no
// record of the command; Pi's history does, and it decides.
// Jari 19:33: a reload did not clear it either; the tab keeps the send's
// record, and that record is reconciled with history after a reload too.
// settled: a status had already said Pi accepted it when the reply was lost.
for (const mode of ["live", "reload", "settled"] as const)
  test(`@browser-conversation a send whose acknowledgement a daemon restart lost resolves from history (${mode})`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await open(page);
    await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
    const editor = page.getByTestId("message-input");
    // Sent from the creation view the message would be held instead.
    await readyConversation(page);
    const id = new URL(page.url()).searchParams.get("conversation") ?? "";
    let sends = 0;
    // Until the restart is over the page hears nothing from the host, so no
    // status settles the command; before a reload no history shows it either.
    const reload = mode === "reload";
    const silent =
      mode === "settled"
        ? []
        : [
            "**/api/v1/events*",
            "**/api/v1/snapshot*",
            "**/api/v1/conversations/*/status*",
          ];
    const history = "**/api/v1/agents/*/history*";
    for (const url of [...silent, ...(reload ? [history] : [])])
      await page.route(url, (route) => route.abort());
    let restarted!: () => void;
    const restart = new Promise<void>((resolve) => {
      restarted = resolve;
    });
    const sendSettled = () =>
      expect.poll(
        () =>
          page.evaluate(() =>
            Object.keys(sessionStorage).some((key) =>
              key.includes(":last-send:"),
            ),
          ),
        { timeout: 20000 },
      );
    const lookedUp =
      mode === "settled"
        ? undefined
        : page.waitForResponse(
            (response) =>
              response.url().includes("/receipt?command_id=") &&
              response.status() === 404,
          );
    await page.route("**/api/v1/conversations/*/send", async (route) => {
      sends++;
      const reply = await route.fetch();
      expect(reply.status()).toBe(200);
      // Pi has written the message before the daemon restarts...
      await expect
        .poll(
          async () => {
            const response = await page.request.get(
              `/api/v1/agents/${id}/history`,
            );
            if (!response.ok()) return false;
            const entries = (await response.json()).entries as {
              kind: string;
              content?: { text?: string };
            }[];
            return entries.some(
              (e) => e.kind === "user" && e.content?.text === "Päällä ovat.",
            );
          },
          { timeout: 20000, intervals: [100] },
        )
        .toBe(true);
      if (mode === "settled") await sendSettled().toBe(false);
      expect((await page.request.get("/fixture/daemon-restart")).status()).toBe(
        204,
      );
      // ...and the page never hears the acknowledgement.
      await route.abort("failed");
      restarted();
    });
    await editor.fill("Päällä ovat.");
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    await restart;
    for (const url of silent) await page.unroute(url);
    // The restarted daemon does not know the command.
    await lookedUp;
    if (reload) {
      await page.unroute(history);
      await page.reload();
    }
    const timeline = page.getByTestId("conversation-timeline");
    await expect(
      timeline.getByTestId("user-content").filter({ hasText: "Päällä ovat." }),
    ).toHaveCount(1, { timeout: 20000 });
    // The page settles the send from Pi's history, not from a receipt.
    await sendSettled().toBe(false);
    await expect(page.getByTestId("send-uncertain")).toHaveCount(0);
    await expect(page.getByTestId("conversation-recheck")).toHaveCount(0);
    await expect(page.getByTestId("send-receipt")).toHaveCount(0);
    await expect(editor).toHaveValue("");
    // Settled, the next message can go; the first one was never repeated.
    await page.unroute("**/api/v1/conversations/*/send");
    await editor.fill("seuraava");
    await expect(
      page.getByTestId("send").and(page.locator('[data-mode="send"]')),
    ).toBeEnabled({ timeout: 30000 });
    expect(sends).toBe(1);
  });

// Jari 8.11.2026 (resend-proven-undelivered): a send the daemon restart
// swallowed before Pi took it kept the tab's composer shut. Once it is proven
// that Pi never got it (readable history without it, empty queue, an idle or
// stopped agent, and a daemon without the command) it goes again by itself,
// once; if the conversation moved on meanwhile its text stays in the field
// instead. Jari 9.11.2026 (large-send-stuck-uncertain): the restarted Pi
// rests, and nothing runs that could still take the message, so a stopped
// agent proves it too: the message goes held, as the composer would send it.
// reload: the tab is reloaded while the outcome is unknown.
for (const mode of ["live", "reload", "moved-on"] as const)
  test(`@browser-conversation a send a daemon restart lost before Pi took it is resolved (${mode})`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await open(page);
    await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
    const editor = page.getByTestId("message-input");
    await readyConversation(page);
    const id = new URL(page.url()).searchParams.get("conversation") ?? "";
    const sendButton = page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'));
    // A first turn makes the native history readable.
    await editor.fill("ensimmäinen");
    await sendButton.click();
    await expectNativeContent(page, 'Selvä. Kysyit: "ensimmäinen".', {
      timeout: 30000,
    });
    const nativeUserTexts = async () => {
      const response = await page.request.get(`/api/v1/agents/${id}/history`);
      if (!response.ok()) return [];
      return (
        (await response.json()).entries as {
          kind: string;
          content?: { text?: string };
        }[]
      )
        .filter((e) => e.kind === "user")
        .map((e) => e.content?.text ?? "");
    };
    let posts = 0;
    let lost!: () => void;
    const restarted = new Promise<void>((resolve) => {
      lost = resolve;
    });
    // Moved on: the page reads no history until another tab has written.
    const history = "**/api/v1/agents/*/history*";
    if (mode === "moved-on")
      await page.route(history, (route) => route.abort());
    await page.route("**/api/v1/conversations/*/send", async (route) => {
      posts++;
      if (posts > 1) return route.continue();
      // The daemon restarts before the message reaches it: Pi never gets it.
      expect((await page.request.get("/fixture/daemon-restart")).status()).toBe(
        204,
      );
      await route.abort("failed");
      lost();
    });
    await editor.fill("Tee toinen.");
    await sendButton.click();
    await restarted;
    if (mode === "reload") await page.reload();
    const timeline = page.getByTestId("conversation-timeline");
    if (mode === "moved-on") {
      const { csrf } = await (await page.request.get("/auth/session")).json();
      // Another tab writes meanwhile; that message starts Pi. Just after the
      // restart the native file may still be settling.
      await expect
        .poll(
          async () =>
            (
              await page.request.post(
                `/api/v1/conversations/${id.slice(3)}/send`,
                {
                  headers: { "X-Agent-Host-CSRF": csrf, Origin: host },
                  data: {
                    message: "toisesta välilehdestä",
                    command_id: randomUUID(),
                  },
                },
              )
            ).ok(),
          { timeout: 20000, intervals: [500] },
        )
        .toBe(true);
      await expect
        .poll(nativeUserTexts, { timeout: 30000 })
        .toContain("toisesta välilehdestä");
      await page.unroute(history);
      // Not sent: the text waits in the field, with one notice saying why.
      await expect(page.getByTestId("send-receipt")).toBeVisible({
        timeout: 30000,
      });
      await expect(page.getByTestId("send-uncertain")).toHaveCount(0);
      await expect(editor).toHaveValue("Tee toinen.");
      await expect(sendButton).toBeEnabled({ timeout: 30000 });
      expect(posts).toBe(1);
      expect(await nativeUserTexts()).not.toContain("Tee toinen.");
      return;
    }
    // Sent again once, held for the stopped agent, and shown as an ordinary
    // message once Pi has it.
    await expectNativeContent(page, 'Selvä. Kysyit: "Tee toinen.".', {
      timeout: 30000,
    });
    await expect(
      timeline.getByTestId("user-content").filter({ hasText: "Tee toinen." }),
    ).toHaveCount(1);
    await expect(page.getByTestId("waiting-message")).toHaveCount(0);
    await expect(page.getByTestId("send-uncertain")).toHaveCount(0);
    await expect(page.getByTestId("send-receipt")).toHaveCount(0);
    await expect(editor).toHaveValue("");
    await editor.fill("kolmas");
    await expect(sendButton).toBeEnabled({ timeout: 30000 });
    expect(posts).toBe(2);
    expect(
      (await nativeUserTexts()).filter((t) => t === "Tee toinen."),
    ).toHaveLength(1);
  });

test("@browser-conversation daemon restart loses controller without declaring the send rejected", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  // Creation first renders an optimistic composer, then mounts the established
  // conversation. Inject controller loss only after that conversation is ready.
  await expect(page).not.toHaveURL(/conversation=new(?:&|$)/);
  const editor = page.getByTestId("message-input");
  await expect(editor).toBeEditable();
  let sends = 0;
  await page.route("**/api/v1/conversations/*/send", async (route) => {
    sends++;
    await route.abort("failed");
  });
  await page.route("**/api/v1/conversations/*/status", (route) =>
    route.fulfill({ status: 404 }),
  );
  await editor.fill("cannot prove delivery");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(page.getByTestId("conversation-problem")).toBeVisible();
  await expect(page.locator(".ah-send-rejected")).toHaveCount(0);
  await expect(editor).toHaveValue("cannot prove delivery");
  await expect(
    page.getByTestId("send").and(page.locator('[data-mode="send"]')),
  ).toBeDisabled();
  expect(sends).toBe(1);
});

test("@browser-conversation queued command with pending ack stays pending without a receipt", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const editor = page.getByTestId("message-input");
  await editor.fill("hidas päätyö");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(editor).toHaveValue("");
  let command = "";
  let queues = 0;
  await page.route("**/api/v1/conversations/*/follow_up", async (route) => {
    queues++;
    command = (route.request().postDataJSON() as { command_id: string })
      .command_id;
    await route.continue();
  });
  await page.route("**/api/v1/conversations/*/status", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (command && body.command_id === command) {
      body.state = "pending";
      body.ack = "pending";
      body.send_receipt = "";
    }
    await route.fulfill({ response, json: body });
  });
  await expect(
    page
      .getByTestId("composer-stop")
      .and(page.locator('[data-stop-target="agent"]')),
  ).toBeVisible();
  await editor.fill("jonoon vain kerran");
  await editor.press("Alt+Enter");
  // Pending, it waits in Pi's queue card and is not given back as unknown.
  await expect(
    page
      .getByTestId("composer-queue")
      .getByRole("listitem")
      .filter({ hasText: "jonoon vain kerran" }),
  ).toBeVisible();
  await expect(page.getByTestId("send-uncertain")).toHaveCount(0);
  await expect(editor).toHaveValue("");
  expect(queues).toBe(1);
});

test("@browser-conversation home card blocks archive during Pi work, shows failure and removes on success", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await page.getByTestId("message-input").fill("päätyö");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expectNativeContent(page, "Selvä. Kysyit:", { timeout: 30000 });
  const agentId = new URL(page.url()).searchParams.get("conversation");
  await page.route("**/api/v1/snapshot", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const agent = body.agents?.find(
      (a: { agent_id: string }) => a.agent_id === agentId,
    );
    if (agent) agent.activity = "running";
    await route.fulfill({ response, json: body });
  });
  await page.getByTestId("home-link").filter({ visible: true }).click();
  await page.reload();
  const card = page
    .getByTestId(/^conversation-card-/)
    .and(page.locator(`[data-agent-id="${agentId}"]`));
  const archive = card
    .getByTestId("archive-conversation")
    .and(page.locator(':not([data-archive-state="archived"])'));
  await expect(card).toBeVisible();
  await expect(archive).toBeDisabled();
  // React Aria opens hover help only after it has seen the pointer move;
  // after a reload Playwright would otherwise jump straight onto the button.
  await page.mouse.move(1, 1);
  await archive.hover();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await page.unroute("**/api/v1/snapshot");
  await page.reload();
  await expect(archive).toBeEnabled({ timeout: 30000 });
  let refused = false;
  await page.route("**/api/v1/workspaces", async (route) => {
    if (
      !refused &&
      route.request().method() === "POST" &&
      route.request().postData()?.includes('"conversation_archive"')
    ) {
      refused = true;
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "writer_conflict" } }),
      });
    } else await route.continue();
  });
  await archive.click();
  await expect(card).toBeVisible();
  await expect(card.getByRole("alert")).toBeVisible();
  await page.locator(".ah-home-name").first().click();
  await expect(page.getByTestId("archive-uncertain")).toHaveCount(0);
  await page.getByTestId("home-link").filter({ visible: true }).click();
  await archive.click();
  await expect(card).toHaveCount(0);
  await expect(page).toHaveURL(/\/workspaces$/);
});

test("@browser-conversation archive hides navigation before host reply and rolls back refusal", async ({
  page,
}) => {
  await stoppedConversation(page);
  const row = page
    .getByRole("navigation")
    .getByTestId(/^(agent-link|home-conversation-.*)$/)
    .and(
      page.locator(
        `a[href*="conversation=${new URL(page.url()).searchParams.get("conversation") ?? ""}"]`,
      ),
    );
  await expect(row).toBeVisible();
  let release!: () => void;
  let requested!: () => void;
  const seen = new Promise<void>((resolve) => {
    requested = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/workspaces", async (route) => {
    if (
      route.request().method() !== "POST" ||
      !route.request().postData()?.includes('"conversation_archive"')
    ) {
      await route.continue();
      return;
    }
    requested();
    await held;
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "writer_conflict" } }),
    });
  });
  await page
    .getByTestId("archive-conversation")
    .and(page.locator(':not([data-archive-state="archived"])'))
    .click();
  await seen;
  await expect(row).toHaveCount(0);
  await expect(page.getByTestId("archive-success")).toHaveCount(0);
  release();
  await expect(row).toBeVisible();
  await expect(page.getByTestId("archive-error").first()).toBeVisible();
});

test("@browser-conversation new conversation keeps icon bar during archive fact delay", async ({
  page,
}) => {
  await open(page);
  await page.route("**/api/v1/snapshot", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.continue();
  });
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page.locator(".ah-agent-header")).toBeVisible();
  await expect(
    page
      .locator(".ah-agent-header")
      .getByTestId(/^(close|dialog-close|process-close)$/),
  ).toBeDisabled();
  await expect(page.getByTestId("archive-state-error")).toHaveCount(0);
  await expect(
    page.locator(".ah-agent-header").getByTestId("conversation-retitle"),
  ).toBeDisabled();
});

test("@browser-conversation empty browser conversation closes without confirmation", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const close = page
    .locator(".ah-agent-header")
    .getByTestId(/^(close|dialog-close|process-close)$/);
  await expect(close).toBeEnabled();
  await close.click();
  await expect(page).toHaveURL(/\/workspaces\/ws_/);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(
    page
      .locator(".ah-agent-header")
      .getByTestId(/^(close|dialog-close|process-close)$/),
  ).toHaveCount(0);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/\?conversation=pi:[0-9a-f-]+$/);
  await expect(
    page
      .locator(".ah-agent-header")
      .getByTestId(/^(close|dialog-close|process-close)$/),
  ).toBeEnabled();
});

test("@browser-conversation empty conversation closes after Pi's idle stop, from the page and the home card", async ({
  page,
}) => {
  // Pi writes no native history before the first message. After the idle
  // stop such a conversation is only the daemon's handle; it must not be
  // stuck in the lists with a close and an archive that both refuse.
  await open(page);
  const header = page.locator(".ah-agent-header");
  const close = header.getByTestId(/^(close|dialog-close|process-close)$/);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/\?conversation=pi:[0-9a-f-]+$/);
  await expect(close).toBeEnabled();
  expect((await page.request.get("/fixture/idle-stop")).status()).toBe(204);
  await page.reload();
  await expect(close).toBeEnabled();
  await close.click();
  await expect(page).toHaveURL(/\/workspaces\/ws_[^?]*$/);
  await expect(header).toHaveCount(0);

  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/\?conversation=pi:[0-9a-f-]+$/);
  const agentId = new URL(page.url()).searchParams.get("conversation");
  await expect(close).toBeEnabled();
  expect((await page.request.get("/fixture/idle-stop")).status()).toBe(204);
  await page.getByTestId("home-link").filter({ visible: true }).click();
  const card = page
    .getByTestId(/^conversation-card-/)
    .and(page.locator(`[data-agent-id="${agentId}"]`));
  await expect(card).toBeVisible();
  const archive = card.getByTestId("archive-conversation");
  await expect(archive).toBeEnabled();
  await archive.click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".ah-home-name").first()).toBeVisible();
  await expect(card).toHaveCount(0);
});

test("@browser-conversation failed close restores the conversation", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/\?conversation=pi:[0-9a-f-]+$/);
  const before = page.url();
  await page.route("**/api/v1/conversations/*/close", (route) =>
    route.fulfill({
      status: 409,
      contentType: "application/json",
      body: '{"schema_version":1,"error":{"code":"control_uncertain"}}',
    }),
  );
  const close = page
    .locator(".ah-agent-header")
    .getByTestId(/^(close|dialog-close|process-close)$/);
  await expect(close).toBeEnabled();
  await close.click();
  await expect(page).toHaveURL(before);
  await expect(page.locator(".ah-agent-header")).toBeVisible();
});

test("@browser-conversation archive stays hidden across delayed successful host reply", async ({
  page,
}) => {
  await stoppedConversation(page);
  const row = page
    .getByRole("navigation")
    .getByTestId(/^(agent-link|home-conversation-.*)$/)
    .and(
      page.locator(
        `a[href*="conversation=${new URL(page.url()).searchParams.get("conversation") ?? ""}"]`,
      ),
    );
  let release!: () => void;
  let requested!: () => void;
  const seen = new Promise<void>((resolve) => {
    requested = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/workspaces", async (route) => {
    if (
      route.request().method() !== "POST" ||
      !route.request().postData()?.includes('"conversation_archive"')
    ) {
      await route.continue();
      return;
    }
    requested();
    await held;
    await route.continue();
  });
  await page
    .getByTestId("archive-conversation")
    .and(page.locator(':not([data-archive-state="archived"])'))
    .click();
  await seen;
  await expect(row).toHaveCount(0);
  release();
  await expect(page).toHaveURL(/\/workspaces\/[^?]+$/);
  await expect(row).toHaveCount(0);
});

test("@browser-conversation explicit new-conversation choice leaves native default unchanged", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  const pill = page.locator(".md-empty-picker");
  await pill.locator(":scope > summary").click();
  await pill.getByTestId("model-gpt-6-nova").check();
  await pill.getByTestId("segment-high").click();
  expect(
    (await (await page.request.get("/api/v1/pi/models")).json()).default_model,
  ).toBeNull();
  await pill.getByTestId(/^(model-commit|conversation-model-start)$/).click();
  await page
    .getByTestId("message-input")
    .fill("nova only in this conversation");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(page.locator(".ah-agent-header .ah-set-chip")).toHaveAttribute(
    "data-model",
    /(?:^|\/)gpt-6-nova$/,
  );
  expect(
    (await (await page.request.get("/api/v1/pi/models")).json()).default_model,
  ).toBeNull();
  // The header explains native state; it cannot change it or create sessions.
  const originalURL = page.url();
  await page.locator(".md-chip-picker > summary").click();
  const pop = page.locator(".md-chip-picker .md-pop");
  await expect(
    pop.getByTestId("model-options").locator('[data-model="gpt-6-astra"]'),
  ).toHaveCount(1);
  await expect(pop.getByTestId("model-current")).toHaveAttribute(
    "data-model",
    /(?:^|\/)gpt-6-nova$/,
  );
  await expect(pop.getByTestId("thinking-current")).toHaveAttribute(
    "data-thinking",
    "high",
  );
  await expect(pop.locator("button, input, select")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator(".md-chip-picker > summary")).toBeFocused();
  expect(page.url()).toBe(originalURL);
});

test("@model-controls an empty session keeps Pi's actual model when its global default changes", async ({
  page,
}) => {
  await open(page);
  const csrf = (await (await page.request.get("/auth/session")).json()).csrf;
  const saveDefault = async (model: string) => {
    const response = await page.request.post("/api/v1/pi/models", {
      headers: {
        Origin: new URL(page.url()).origin,
        "X-Agent-Host-CSRF": csrf,
      },
      data: { provider: "openai-codex", model, thinking: "high" },
    });
    expect(response.status()).toBe(200);
  };
  await saveDefault("gpt-6.1-sol");
  await page.reload();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/\?conversation=pi:/);
  await expect(page.locator(".ah-agent-header .ah-set-chip")).toHaveAttribute(
    "data-model",
    /(?:^|\/)gpt-6\.1-sol$/,
  );
  await expect(page.locator(".ah-agent-header .ah-set-chip")).toHaveAttribute(
    "data-thinking",
    "high",
  );
  await saveDefault("gpt-6-nova");
  await page.reload();
  await expect(page.locator(".ah-agent-header .ah-set-chip")).toHaveAttribute(
    "data-model",
    /(?:^|\/)gpt-6\.1-sol$/,
  );
  await expect(page.locator(".ah-agent-header .ah-set-chip")).toHaveAttribute(
    "data-thinking",
    "high",
  );
  await expect(page.locator(".md-pill")).toHaveAttribute(
    "data-model",
    /(?:^|\/)gpt-6\.1-sol$/,
  );
  await page
    .getByTestId("message-input")
    .fill("Keep the already-running model");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/v1/conversations")).json())
          .sessions[0]?.state,
    )
    .toBe("idle");
  await page.reload();
  await expect(page.locator(".ah-agent-header .ah-set-chip")).toHaveAttribute(
    "data-model",
    /(?:^|\/)gpt-6\.1-sol$/,
  );
  expect(
    (await (await page.request.get("/api/v1/pi/models")).json()).default_model,
  ).toBe("gpt-6-nova");
});

for (const width of [1280, 390]) {
  test(`@model-controls empty choice stays in this conversation at ${width}px`, async ({
    page,
  }) => {
    await open(page);
    await page.setViewportSize({ width, height: 844 });
    // Select a real native default so the empty header can name it before history exists.
    const saved = await page.request.post("/api/v1/pi/models", {
      headers: {
        Origin: new URL(page.url()).origin,
        "X-Agent-Host-CSRF": (
          await (await page.request.get("/auth/session")).json()
        ).csrf,
      },
      data: {
        provider: "openai-codex",
        model: "gpt-6.1-sol",
        thinking: "high",
      },
    });
    expect(saved.status()).toBe(200);
    await page.reload();
    await expect(
      page.getByTestId(/^(new-conversation|conversation-start)$/),
    ).toBeEnabled();
    await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
    await expect(page).toHaveURL(/\?conversation=pi:/);
    const original = page.url();
    const header = page.locator(".ah-agent-header .ah-set-chip");
    await expect(header).toHaveAttribute("data-model", /(?:^|\/)gpt-6\.1-sol$/);
    await expect(header).toHaveAttribute("data-thinking", "high");
    await expect(page.locator(".md-chip-picker")).toHaveCount(0);
    const draft = page.getByTestId("message-input");
    await draft.fill("Keep this draft and use Nova");
    const pill = page.locator(".md-pill");
    const box = await pill.boundingBox();
    if (!box) throw new Error("missing pill");
    expect(box.height).toBeLessThanOrEqual(36);
    expect(box.width).toBeLessThan(300);
    const radius = await pill.evaluate((e) =>
      Number.parseFloat(getComputedStyle(e).borderTopLeftRadius),
    );
    expect(radius).toBeGreaterThanOrEqual(box.height / 2);
    // The text and pill share one bordered input surface, not two touching boxes.
    const field = page.locator(".ah-cbox");
    const surface = await field.boundingBox();
    const text = await draft.boundingBox();
    if (!surface || !text) throw new Error("missing composer surface");
    expect(box.x).toBeGreaterThan(surface.x);
    expect(box.x + box.width).toBeLessThan(surface.x + surface.width);
    expect(box.y).toBeGreaterThanOrEqual(text.y + text.height);
    expect(box.y + box.height).toBeLessThan(surface.y + surface.height);
    expect(surface.x + surface.width).toBeLessThanOrEqual(width);
    await draft.focus();
    const ring = () =>
      field.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          style: style.outlineStyle,
          width: Number.parseFloat(style.outlineWidth),
          border: Number.parseFloat(style.borderTopWidth),
        };
      });
    expect(await ring()).toMatchObject({ style: "solid" });
    expect((await ring()).width).toBeGreaterThan(0);
    expect((await ring()).border).toBeGreaterThan(0);
    expect(await draft.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe(
      "none",
    );
    // Attachment, commands and file controls precede the model disclosure.
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("attach-file")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("command-palette")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId("file-picker")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(pill).toBeFocused();
    // A slow background refresh must not replace preloaded choices with a spinner.
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route("**/api/v1/pi/models", async (route) => {
      await held;
      await route.continue();
    });
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await pill.click();
    const picker = page.locator(".md-empty-picker .md-pop");
    await expect(picker.getByTestId("model-gpt-6-nova")).toBeVisible({
      timeout: 1000,
    });
    await expect(picker.getByTestId("model-gpt-6-nova")).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).include(".md-empty-picker").analyze())
        .violations,
    ).toEqual([]);
    const panel = await picker.boundingBox();
    if (!panel) throw new Error("missing panel");
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(width);
    await picker.getByTestId("model-gpt-6-nova").check();
    await picker.getByTestId("segment-high").click();
    await picker
      .getByTestId(/^(model-commit|conversation-model-start)$/)
      .click();
    release();
    await expect(page).toHaveURL(original);
    await expect(draft).toHaveValue("Keep this draft and use Nova");
    await expect(header).toHaveAttribute("data-model", /(?:^|\/)gpt-6-nova$/);
    await expect(header).toHaveAttribute("data-thinking", "high");
    await expect(pill).toBeFocused();
    expect(
      (await (await page.request.get("/api/v1/conversations")).json()).sessions,
    ).toHaveLength(1);
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    await expect(pill).toHaveCount(0);
    await expect(page.locator(".ah-agent-header .ah-set-chip")).toHaveAttribute(
      "data-model",
      /(?:^|\/)gpt-6-nova$/,
    );
    const id = new URL(original).searchParams.get("conversation")?.slice(3);
    await expect
      .poll(
        async () =>
          (
            await (
              await page.request.get(`/api/v1/conversations/${id}/status`)
            ).json()
          ).state,
      )
      .toBe("idle");
    await page.reload();
    await expect(page.locator(".ah-agent-header .ah-set-chip")).toHaveAttribute(
      "data-model",
      /(?:^|\/)gpt-6-nova$/,
    );
    await expect(page).toHaveURL(original);
    expect(
      (await (await page.request.get("/api/v1/pi/models")).json())
        .default_model,
    ).toBe("gpt-6.1-sol");
  });
}

// The agreed lifetime of a notice row (archive-notice-too-long).
const NOTICE_LIFETIME_MS = 8_000;

test("@conversation-details archive undo returns to conversation; offer pauses and expires", async ({
  page,
}) => {
  const id = await stoppedConversation(page);
  await page.clock.install();
  await archiveFromConfirmedView(page, () =>
    page
      .getByTestId("archive-conversation")
      .and(page.locator(':not([data-archive-state="archived"])')),
  );
  const notice = page.getByTestId("archive-notice");
  await expect(notice).toBeVisible();
  await expect(page.locator("main h1")).toBeFocused();
  await expect(notice.getByTestId("restore-notice")).toBeEnabled();
  await notice.hover();
  await page.clock.fastForward(NOTICE_LIFETIME_MS + 1000);
  await expect(notice).toBeVisible();
  const undo = notice.getByTestId("restore-notice");
  await undo.focus();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(NOTICE_LIFETIME_MS + 1000);
  await expect(notice).toBeVisible();
  await undo.click();
  await expect(page).toHaveURL(new RegExp(`(?:conversation=|agents/)${id}`));
  await expect(notice).toHaveCount(0);
});

test("@conversation-details archive offer rides in the next header and expires unpaused", async ({
  page,
}) => {
  await stoppedConversation(page);
  // Install before the notice schedules its timeout: a later installation
  // does not move already-scheduled native timers onto Playwright's clock.
  await page.clock.install();
  await archiveFromConfirmedView(page, () =>
    page
      .getByTestId("archive-conversation")
      .and(page.locator(':not([data-archive-state="archived"])')),
  );
  const notice = page.getByTestId("archive-notice");
  await expect(notice).toBeVisible();
  await expect(notice.getByTestId("restore-notice")).toBeEnabled();
  const workspace = page.url();
  // The next conversation carries the offer as a row in its top bar, above
  // the thread rather than over the composer.
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(
    page.locator(".ah-agent-header").getByTestId("archive-notice"),
  ).toBeVisible();
  // The row may now lie under the pointer that pressed the button, which
  // rightly pauses it.
  await page.mouse.move(0, 0);
  const editor = page.getByTestId("message-input");
  await editor.focus();
  // A writer's Esc belongs to the composer, not to the notice.
  await page.keyboard.press("Escape");
  await expect(notice).toBeVisible();
  await expect(editor).toBeFocused();
  // Advance through callbacks rather than jumping past React's timer cleanup
  // and rescheduling when the pointer leaves the transient notice.
  await page.clock.runFor(NOTICE_LIFETIME_MS + 100);

  await expect(notice).toHaveCount(0);
  await page.goto(workspace);
  await page.locator(".ah-workspace-archive > summary").click();
  await expect(
    page
      .getByTestId("restore-conversation")
      .or(
        page
          .getByTestId("archive-conversation")
          .and(page.locator('[data-archive-state="archived"]')),
      ),
  ).toBeVisible();
});

test("@conversation-details failed bash has a cause corner and one failed tool in summary", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await page.getByTestId("message-input").fill("epäonnistu");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  const summary = page.getByTestId("history-stage-toggle");
  await expect(summary).toBeVisible({ timeout: 25000 });
  await summary.click();
  const tool = page
    .getByTestId("tool-row")
    .and(page.locator('[data-tool-name="bash"]'))
    .first();
  await expect(tool).toHaveAttribute("data-state", "failed");
  await expect(
    tool.locator('[title="Command exited with code 2"]'),
  ).toBeVisible();
  await tool.getByRole("button").first().click();
  await expect(tool).toContainText("synteettinen komento epäonnistui");
  await expect(tool.locator("pre")).not.toContainText([
    "Command exited with code 2",
  ]);
});

for (const navigation of ["jump", "small scrolls"] as const) {
  test(`@conversation-details latest pill clears unread replies with ${navigation}`, async ({
    page,
  }) => {
    await open(page);
    await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
    // Establish a native baseline before leaving the end, then send a second turn.
    await page.getByTestId("message-input").fill("unread baseline");
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    await expectNativeContent(page, 'Selvä. Kysyit: "unread baseline".', {
      exact: true,
    });
    await page.addStyleTag({
      content: ".ah-timeline { min-height: 4000px !important; }",
    });
    await page.getByTestId("message-input").fill("unread reply");
    const stream = page.locator(".ah-conversation-stream");
    await expect
      .poll(() => stream.evaluate((node) => node.scrollTop))
      .toBeGreaterThan(0);
    // Scroll as a reader, after layout has put the following view at its end.
    // A synthetic scrollTop assignment can race the native-page resize.
    await expect
      .poll(() =>
        stream.evaluate(
          (node) => node.scrollHeight - node.clientHeight - node.scrollTop,
        ),
      )
      .toBeLessThan(2);
    await stream.hover();
    await page.mouse.wheel(0, -5000);
    await expect(page.getByTestId("jump-latest")).toBeVisible();
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    await expect(page.getByTestId("jump-latest")).toBeVisible();
    const reply = page.getByTestId("jump-latest");
    await expect(reply).toHaveAttribute("data-unread-count", "2", {
      timeout: 25000,
    });
    // jump-latest-chip-layout: the arrow once wrapped below the label. It sits
    // on the label's line, on the chip's vertical centre.
    const offset = await reply.evaluate((chip) => {
      const own = chip.getBoundingClientRect();
      const icon = chip.querySelector("svg")?.getBoundingClientRect();
      if (!icon) return Number.NaN;
      return icon.top + icon.height / 2 - (own.top + own.height / 2);
    });
    expect(Math.abs(offset)).toBeLessThan(1);
    if (navigation === "jump") {
      await reply.press("Enter");
      await expect(reply).toHaveCount(0);
      await expect(stream).toBeFocused();
    } else {
      // Make each reply taller than the viewport: a percentage-visible rule
      // must not leave these unread, nor may reaching the bottom clear both.
      await page.addStyleTag({
        content: "[data-reply-entry] { min-height: 900px; }",
      });
      await stream.hover();
      const counts = new Set<number>();
      for (let step = 0; step < 500; step++) {
        const count = Number(await reply.getAttribute("data-unread-count"));
        counts.add(count);
        if (count === 0) break;
        const before = await stream.evaluate((node) => node.scrollTop);
        await page.mouse.wheel(0, 40);
        await expect
          .poll(() => stream.evaluate((node) => node.scrollTop))
          .toBeGreaterThan(before);
      }
      expect(counts.has(1)).toBe(true);
      expect(counts.has(0)).toBe(true);
      // All answers were seen before reaching the bottom of the tall last one.
      expect(
        await stream.evaluate(
          (node) => node.scrollHeight - node.clientHeight - node.scrollTop,
        ),
      ).toBeGreaterThan(120);
      await page.mouse.wheel(0, 20000);
      await expect(reply).toHaveCount(0);
    }
  });
}
// Jari 17.10.2026 (rail-home-and-hover): the server name is the way home, and
// rail rows change on hover although the rail's grey is near the hover grey.
test("@browser-conversation rail server name goes home by mouse, keyboard and from the phone drawer; rail rows show hover", async ({
  page,
}) => {
  await open(page);
  const rail = page.getByTestId("workspace-navigation");
  const server = rail.locator(".ah-rail-server");
  await server.click();
  await expect(page).toHaveURL(/\/workspaces$/);
  await rail.getByTestId("workspace-ordinary-dir").click();
  await expect(page).not.toHaveURL(/\/workspaces$/);
  // Route focus is applied after the workspace mounts; do not race it with
  // an explicit focus of the way-home link.
  await expect(page.locator("main h1")).toBeFocused();
  await server.focus();
  await expect(server).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/workspaces$/);
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const home = rail.getByTestId("home-link");
    await page.mouse.move(900, 600);
    const rest = await home.evaluate(
      (e) => getComputedStyle(e).backgroundColor,
    );
    await home.hover();
    // The ink tint, not the surface grey that matches the rail itself.
    const tint = await rail.evaluate((nav) => {
      const probe = document.createElement("span");
      probe.style.background = "var(--ah-control-hover)";
      nav.append(probe);
      const value = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return value;
    });
    await expect
      .poll(() => home.evaluate((e) => getComputedStyle(e).backgroundColor))
      .toBe(tint);
    expect(tint).not.toBe(rest);
  }
  await page.emulateMedia({ colorScheme: "light" });
  await rail.getByTestId("workspace-ordinary-dir").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("navigation-open").first().click();
  await expect(page.locator(".ah-mobile-open")).toHaveCount(1);
  await page.locator(".ah-mobile-open .ah-rail-server").first().click();
  await expect(page).toHaveURL(/\/workspaces$/);
  await expect(page.locator(".ah-mobile-open")).toHaveCount(0);
});

test("@stream-revocation logout in another tab ends the live journal and opens login", async ({
  page,
  context,
}) => {
  const connected = page.waitForResponse(
    (response) => new URL(response.url()).pathname === "/api/v1/events",
  );
  await open(page);
  expect((await connected).status()).toBe(200);
  const other = await context.newPage();
  try {
    await other.goto("/workspaces");
    const session = await (await other.request.get("/auth/session")).json();
    expect(
      (
        await other.request.post("/auth/logout", {
          headers: { Origin: host, "X-Agent-Host-CSRF": session.csrf },
        })
      ).status(),
    ).toBe(204);
    await expect(page.getByTestId("github-sign-in")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByTestId("message-input")).toHaveCount(0);
    await new AxeBuilder({ page }).analyze().then((result) => {
      expect(result.violations).toEqual([]);
    });
  } finally {
    await other.close();
  }
});

// Resolve native conversation identity from the host, not translated link copy.
async function nativeConversationLink(
  page: import("@playwright/test").Page,
  scope: import("@playwright/test").Page | import("@playwright/test").Locator,
  title: string | RegExp,
) {
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  const agent = snapshot.agents.find((entry: { title: { display: string } }) =>
    typeof title === "string"
      ? entry.title.display.includes(title)
      : title.test(entry.title.display),
  );
  if (!agent) throw new Error("Missing native conversation identity");
  return scope
    .getByTestId(/^(agent-link|home-conversation-.*)$/)
    .and(
      page.locator(
        `a[href*="conversation=${encodeURIComponent(agent.agent_id)}"], a[href*="conversation=${agent.agent_id}"], a[href="/agents/${agent.agent_id}"]`,
      ),
    );
}

// Native content is asserted independently of translated controls. This helper
// only reads rendered content; it never finds an element for an interaction.
async function expectNativeContent(
  scope: import("@playwright/test").Page | import("@playwright/test").Locator,
  expected: string | RegExp,
  options: {
    count?: number;
    visible?: boolean;
    exact?: boolean;
    timeout?: number;
  } = {},
) {
  const { count, visible = true, exact = false, timeout } = options;
  const read = () =>
    scope.locator("*").evaluateAll(
      (nodes, args) => {
        const normalize = (text: string) => text.replace(/\s+/g, " ").trim();
        const matches = (node: Element) => {
          if (["SCRIPT", "STYLE", "HEAD"].includes(node.tagName)) return false;
          const text = normalize(node.textContent ?? "");
          return args.regex
            ? new RegExp(args.regex, args.flags).test(text)
            : args.exact
              ? text === normalize(args.text)
              : text.includes(normalize(args.text));
        };
        return nodes.filter(
          (node) =>
            matches(node) &&
            ![...node.children].some(matches) &&
            (!args.visible ||
              (node.getClientRects().length > 0 &&
                getComputedStyle(node).visibility !== "hidden")),
        ).length;
      },
      {
        text: typeof expected === "string" ? expected : "",
        regex: expected instanceof RegExp ? expected.source : "",
        flags: expected instanceof RegExp ? expected.flags : "",
        exact,
        visible,
      },
    );
  if (count === undefined)
    await expect.poll(read, { timeout }).toBeGreaterThan(0);
  else await expect.poll(read, { timeout }).toBe(count);
}

test("@browser-conversation title dots follow automatic observations and manual replies", async ({
  page,
}) => {
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await readyConversation(page);
  const id = new URL(page.url()).searchParams.get("conversation");
  let naming = true;
  try {
    await page.route("**/api/v1/snapshot", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const agent = body.agents.find(
        (a: { agent_id: string }) => a.agent_id === id,
      );
      if (agent)
        agent.title.generation_state = naming ? "pending" : "not_requested";
      await route.fulfill({ response, json: body });
    });
    await page.reload();
    const row = page.getByTestId("conversation-title");
    await expect(row).toHaveAttribute("aria-busy", "true");
    const nativeTitle = await page.getByTestId("workspace-title").textContent();
    naming = false;
    await page.reload();
    await expect(row).toHaveAttribute("aria-busy", "false");
    await expect(page.getByTestId("workspace-title")).toHaveText(
      nativeTitle ?? "",
    );
    await page
      .getByTestId("message-input")
      .fill("Synteettinen otsikon luonnin tarkistus");
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    const action = page.getByTestId("conversation-retitle");
    await expect(action).toBeEnabled();
    for (const failed of [false, true]) {
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("**/regenerate_title", async (route) => {
        await held;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            schema_version: 1,
            state: failed ? "failed" : "done",
            ...(failed ? { reason: "model_unavailable" } : {}),
          }),
        });
      });
      await action.click();
      await expect(row).toHaveAttribute("aria-busy", "true");
      await expect(action).toBeDisabled();
      release();
      await expect(row).toHaveAttribute("aria-busy", "false");
      await expect(action).toBeEnabled();
      if (failed) await expect(page.getByTestId("title-error")).toBeVisible();
      await page.unroute("**/regenerate_title");
    }
  } finally {
    // Snapshot polls can still be in route.fetch when assertions finish (or
    // fail). Stop routing before fixture teardown closes the page.
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
});

test("@browser-conversation a mermaid fence in a reply is drawn as an image", async ({
  page,
}) => {
  const scripts: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") scripts.push(request.url());
  });
  const mermaidLoaded = () =>
    scripts.some((url) => /\/mermaid\.core-/.test(url));
  await open(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  // Mermaid is fetched only when a reply contains a diagram.
  expect(mermaidLoaded()).toBe(false);
  await page.getByTestId("message-input").fill("piirrä kaavio");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  const diagram = page.getByTestId("mermaid-diagram");
  await expect(diagram).toBeVisible({ timeout: 30000 });
  // A real render in Chromium: the image decodes to a nonblank SVG.
  await expect
    .poll(() =>
      diagram
        .locator("img")
        .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth),
    )
    .toBeGreaterThan(50);
  // Mermaid's own SVG never stays in the page, only the image of it.
  await expect(page.locator("svg[aria-roledescription]")).toHaveCount(0);
  expect(mermaidLoaded()).toBe(true);
});
