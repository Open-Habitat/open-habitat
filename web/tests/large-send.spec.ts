import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

// Jari 9.11.2026 (large-send-stuck-uncertain): six large pictures sent on
// the test server never reached Pi. Taking in a frame of a hundred megabytes
// outlasted the time the host gave Pi, the cut-off write left the message
// uncertain, a server restart made a held one unknown too, and the page then
// drew a dashed bubble under a warning that claimed the text was in an empty
// field. A large send either arrives, or comes back with a true message.

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});

// A valid one-pixel PNG; bytes after its end make it as large as wanted.
const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";

async function openConversation(page: import("@playwright/test").Page) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  await expect(
    page
      .locator(".ah-agent-header")
      .getByTestId(/^(archive-conversation|dialog-close)$/),
  ).toBeVisible();
  await expect(page.getByTestId("message-input")).toBeEnabled();
  return new URL(page.url()).searchParams.get("conversation") ?? "";
}

/** Picks `count` pictures of `mib` MiB each, built in the browser rather
 * than copied through the Playwright transport. */
async function pickPictures(
  page: import("@playwright/test").Page,
  count: number,
  mib: number,
) {
  await page
    .locator(".ah-composer")
    .locator('input[type="file"]')
    .evaluate(
      (element: HTMLInputElement, { png, count, mib }) => {
        const head = Uint8Array.from(atob(png), (c) => c.charCodeAt(0));
        const data = new DataTransfer();
        for (let i = 1; i <= count; i++) {
          const bytes = new Uint8Array(mib * 1024 * 1024);
          bytes.set(head);
          bytes[head.length] = i; // distinct files, not one attached twice
          data.items.add(
            new File([bytes], `iso-${i}.png`, { type: "image/png" }),
          );
        }
        element.files = data.files;
        element.dispatchEvent(new Event("change", { bubbles: true }));
      },
      { png, count, mib },
    );
}

async function nativeUserTexts(
  page: import("@playwright/test").Page,
  id: string,
) {
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
}

test("pictures the agent cannot take in time come back with a true message, then go", async ({
  page,
}) => {
  test.setTimeout(150000);
  const id = await openConversation(page);
  const field = page.getByTestId("message-input");
  const composer = page.locator(".ah-composer");
  const chips = composer.getByTestId("attachment-chip");
  const send = page.getByTestId("send").and(page.locator('[data-mode="send"]'));
  // A first turn: the agent runs and is idle, so the next send goes direct.
  await field.fill("hei");
  await send.click();
  await expect(
    page.locator('.ah-feed > li[data-kind="assistant"]'),
  ).toHaveCount(1, { timeout: 30000 });
  await pickPictures(page, 6, 2);
  await expect(chips).toHaveCount(6, { timeout: 30000 });
  await field.fill("Tässä ne isot liitteet.");
  // Pi takes its input in so slowly that the pictures outlast the budget.
  await page.request.get("/fixture/scenario?value=pi-slow-intake");
  await send.click();
  const receipt = page.getByTestId("send-receipt");
  await expect(receipt).toContainText("siirtäminen agentille keskeytyi", {
    timeout: 30000,
  });
  // The draft and its pictures are back; nothing claims an unknown outcome.
  await expect(field).toHaveValue("Tässä ne isot liitteet.");
  await expect(chips).toHaveCount(6);
  await expect(page.getByTestId("send-uncertain")).toHaveCount(0);
  await expect(page.getByTestId("waiting-message")).toHaveCount(0);
  await expect(page.locator('.ah-feed > li[data-kind="user"]')).toHaveCount(1);

  // Pi ended with the cut-off input; the next send starts it again and is
  // held meanwhile. Still too slow: the held message comes back the same
  // way, and the notice stays until the person sends again.
  await send.click();
  const held = page.getByTestId("held-message-notice");
  await expect(held).toContainText("siirtäminen agentille keskeytyi", {
    timeout: 45000,
  });
  await expect(field).toHaveValue("Tässä ne isot liitteet.");
  await expect(chips).toHaveCount(6);
  await expect(page.getByTestId("waiting-message")).toHaveCount(0);
  await expect(page.getByTestId("send-uncertain")).toHaveCount(0);
  await page.waitForTimeout(7000);
  await expect(held).toBeVisible();
  expect(
    (await nativeUserTexts(page, id)).some((t) => t.includes("isot liitteet")),
  ).toBe(false);

  // With a Pi that keeps up, the same send arrives and settles normally.
  await page.request.get("/fixture/scenario?value=ready");
  await send.click();
  await expect(held).toHaveCount(0);
  const sent = page.locator('.ah-feed > li[data-kind="user"]').last();
  await expect(sent.getByTestId("attachment-chip")).toHaveCount(6, {
    timeout: 45000,
  });
  await expect(sent).toContainText("Tässä ne isot liitteet.");
  await expect(
    page.locator('.ah-feed > li[data-kind="assistant"]'),
  ).toHaveCount(2, { timeout: 30000 });
  await expect(field).toHaveValue("");
  await expect(chips).toHaveCount(0);
  await expect(page.getByTestId("waiting-message")).toHaveCount(0);
  await expect(receipt).toHaveCount(0);
  expect(
    (await nativeUserTexts(page, id)).filter((t) =>
      t.includes("Tässä ne isot liitteet."),
    ),
  ).toHaveLength(1);
});

test("about 90 MB of pictures arrive and settle as an ordinary send", async ({
  page,
}) => {
  test.setTimeout(150000);
  const id = await openConversation(page);
  const field = page.getByTestId("message-input");
  const chips = page.locator(".ah-composer").getByTestId("attachment-chip");
  await field.fill("hei");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(
    page.locator('.ah-feed > li[data-kind="assistant"]'),
  ).toHaveCount(1, { timeout: 30000 });
  await pickPictures(page, 6, 15);
  await expect(chips).toHaveCount(6, { timeout: 60000 });
  await field.fill("Kuusi isoa kuvaa.");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  const sent = page.locator('.ah-feed > li[data-kind="user"]').last();
  await expect(sent.getByTestId("attachment-chip")).toHaveCount(6);
  await expect(
    page.locator('.ah-feed > li[data-kind="assistant"]'),
  ).toHaveCount(2, { timeout: 90000 });
  await expect(page.getByTestId("send-uncertain")).toHaveCount(0);
  await expect(page.getByTestId("send-receipt")).toHaveCount(0);
  await expect(field).toHaveValue("");
  expect(
    (await nativeUserTexts(page, id)).filter((t) =>
      t.includes("Kuusi isoa kuvaa."),
    ),
  ).toHaveLength(1);
});

// A held message whose outcome a server restart made unknown: its text is
// back in the field, one warning says so, and no dashed bubble remains.
// The check visibly runs each time, and sending the text again ends it.
test("a held message a restart made unknown waits in the field under one warning", async ({
  page,
}) => {
  test.setTimeout(120000);
  const id = await openConversation(page);
  const field = page.getByTestId("message-input");
  const send = page.getByTestId("send").and(page.locator('[data-mode="send"]'));
  await field.fill("ensimmäinen");
  await send.click();
  await expect(
    page.locator('.ah-feed > li[data-kind="assistant"]'),
  ).toHaveCount(1, { timeout: 30000 });
  // The restart leaves the agent resting; the next send is held and starts
  // it, slowly enough that the second restart comes before Pi has it.
  expect((await page.request.get("/fixture/daemon-restart")).status()).toBe(
    204,
  );
  const statusOf = async () =>
    (
      await page.request.get(`/api/v1/conversations/${id.slice(3)}/status`)
    ).json();
  await expect
    .poll(async () => (await statusOf()).state, { timeout: 30000 })
    .toBe("stopped");
  await page.request.get("/fixture/scenario?value=pi-slow-start");
  let posts = 0;
  await page.route("**/api/v1/conversations/*/send", async (route) => {
    posts++;
    const response = await route.fetch();
    if (posts === 1)
      expect((await page.request.get("/fixture/daemon-restart")).status()).toBe(
        204,
      );
    await route.fulfill({ response });
  });
  await field.fill("Pidä tämä.");
  await expect(send).toBeEnabled({ timeout: 30000 });
  await send.click();
  const warning = page.getByTestId("send-uncertain");
  await expect(warning).toBeVisible({ timeout: 30000 });
  await expect(warning).toHaveAttribute("data-reason", "held");
  await expect(warning).toContainText("Teksti on kirjoituskentässä");
  await expect(field).toHaveValue("Pidä tämä.");
  await expect(page.getByTestId("waiting-message")).toHaveCount(0);
  // Each check says when it ran.
  await warning.getByTestId("conversation-recheck").click();
  await expect(warning).toContainText("Tarkistettu klo", { timeout: 30000 });
  // It claims the text is in the field only while it is.
  await field.fill("");
  await expect(warning).not.toContainText("Teksti on kirjoituskentässä");
  // Sent again by the person, it goes once and the warning ends.
  await page.request.get("/fixture/scenario?value=ready");
  await field.fill("Pidä tämä.");
  await send.click();
  await expect(warning).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (await nativeUserTexts(page, id)).filter((t) => t === "Pidä tämä.")
          .length,
      { timeout: 45000 },
    )
    .toBe(1);
  await expect(page.getByText('Selvä. Kysyit: "Pidä tämä.".')).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByTestId("waiting-message")).toHaveCount(0);
  await expect(field).toHaveValue("");
  expect(posts).toBe(2);
});
