import type { Page } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

// Jari 28.–29.10.2026, test server: a recap written before Pi rested was not
// shown until typing woke Pi, and an automatic recap whose timer a daemon
// restart cut off never came. Both run the real gateway, daemon controller,
// its restart and the fake Pi.

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});
test.beforeEach(async ({ page }) => {
  expect((await page.request.get("/fixture/reset-clock")).status()).toBe(204);
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
});

const editor = (page: Page) => page.getByTestId("message-input");
const send = (page: Page) =>
  page.getByTestId("send").and(page.locator('[data-mode="send"]'));
const card = (page: Page) => page.getByTestId("recap-card");

async function scenario(page: Page, value: string) {
  expect(
    (await page.request.get(`/fixture/scenario?value=${value}`)).status(),
  ).toBe(204);
}

async function status(page: Page, id: string) {
  const reply = await page.request.get(
    `/api/v1/conversations/${id.slice(3)}/status`,
  );
  return reply.ok() ? await reply.json() : { state: `http_${reply.status()}` };
}

async function nativeRecap(page: Page, id: string) {
  const reply = await page.request.get(`/api/v1/agents/${id}/recap`);
  expect(reply.ok()).toBe(true);
  return (await reply.json()) as {
    recap: { through: string; trigger: string } | null;
    latest_message: string;
  };
}

async function answeredConversation(page: Page, text: string) {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi:/);
  const id = new URL(page.url()).searchParams.get("conversation") ?? "";
  await editor(page).fill(text);
  await send(page).click();
  await expect(page.locator("main")).toContainText(`Kysyit: "${text}"`, {
    timeout: 20000,
  });
  await expect.poll(async () => (await status(page, id)).state).toBe("idle");
  return id;
}

function countWakes(page: Page) {
  const wakes: number[] = [];
  page.on("response", (response) => {
    if (
      response.request().method() === "POST" &&
      response.url().endsWith("/continue")
    )
      wakes.push(response.status());
  });
  return wakes;
}

test("@recap a recap written before Pi rested is shown while it rests", async ({
  page,
}) => {
  test.setTimeout(90000);
  try {
    await scenario(page, "pi-recap");
    const id = await answeredConversation(page, "ennen lepoa");
    await expect
      .poll(
        async () => {
          const native = await nativeRecap(page, id);
          return native.recap?.through === native.latest_message;
        },
        { timeout: 20000 },
      )
      .toBe(true);
    // The recap scenario restarts the daemon with its own owed-recap pass;
    // this recap is already written, so nothing starts Pi.
    expect((await page.request.get("/fixture/daemon-restart")).status()).toBe(
      204,
    );
    const wakes = countWakes(page);
    await page.reload();
    await expect(card(page)).toHaveAttribute("data-trigger", "automatic", {
      timeout: 20000,
    });
    expect((await status(page, id)).state).toBe("stopped");
    await page.waitForTimeout(1000);
    expect((await status(page, id)).state).toBe("stopped");
    expect(wakes).toHaveLength(0);
  } finally {
    await scenario(page, "ready");
  }
});

test("@recap an automatic recap a daemon restart cut off is made after the restart", async ({
  page,
}) => {
  test.setTimeout(120000);
  try {
    // The turn ends with no recap yet: the person's three-minute delay is
    // still running when the daemon restarts.
    const id = await answeredConversation(page, "ennen päivitystä");
    expect((await nativeRecap(page, id)).recap).toBeNull();
    await scenario(page, "pi-recap");
    expect((await page.request.get("/fixture/daemon-restart")).status()).toBe(
      204,
    );
    const wakes = countWakes(page);
    await page.reload();
    // The restarted daemon starts Pi only for the recap and stops it again.
    await expect
      .poll(
        async () => {
          const native = await nativeRecap(page, id);
          return native.recap?.through === native.latest_message
            ? native.recap.trigger
            : "";
        },
        { timeout: 30000 },
      )
      .toBe("automatic");
    await expect(card(page)).toHaveAttribute("data-trigger", "automatic", {
      timeout: 20000,
    });
    await expect
      .poll(async () => (await status(page, id)).state, { timeout: 20000 })
      .toBe("stopped");
    // The rest still holds: nothing woke Pi for the person, and the card of
    // the restart is still there to tell what happened.
    expect(wakes).toHaveLength(0);
    const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
    expect(
      snapshot.agents.find((a: { agent_id: string }) => a.agent_id === id)
        ?.rest,
    ).toMatchObject({ cause: "restart", awake: false });
    expect(
      (
        await (
          await page.request.get(
            `/api/v1/agents/${id}/history?limit=100&after=`,
          )
        ).json()
      ).entries.filter((e: { kind: string }) => e.kind === "user"),
    ).toHaveLength(1);
  } finally {
    await scenario(page, "ready");
  }
});
