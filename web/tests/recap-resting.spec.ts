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
    // Interrupt an actual model call, not merely the idle timer before it.
    await scenario(page, "pi-recap");
    expect((await page.request.get("/fixture/recap-hold?arm=1")).status()).toBe(
      204,
    );
    const id = await answeredConversation(page, "ennen päivitystä");
    await expect
      .poll(async () =>
        (await page.request.get("/fixture/recap-hold")).status(),
      )
      .toBe(204);
    expect((await nativeRecap(page, id)).recap).toBeNull();
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

test("@recap interrupted generation leaves a card when restart recovery cannot start Pi", async ({
  page,
}) => {
  test.setTimeout(90000);
  try {
    await scenario(page, "pi-recap");
    expect((await page.request.get("/fixture/recap-hold?arm=1")).status()).toBe(
      204,
    );
    const id = await answeredConversation(page, "kesken jäänyt katsaus");
    await expect
      .poll(async () =>
        (await page.request.get("/fixture/recap-hold")).status(),
      )
      .toBe(204);
    // Recovery runs in the reserved background place, which a person's
    // full limit never takes; a Pi that cannot start is what stops it.
    expect(
      (await page.request.get("/fixture/pi-start-fail?on=1")).status(),
    ).toBe(204);
    expect((await page.request.get("/fixture/daemon-restart")).status()).toBe(
      204,
    );
    await page.reload();
    await expect(page.getByTestId("recap-failure")).toBeVisible();
    expect((await nativeRecap(page, id)).recap).toBeNull();
    expect((await status(page, id)).recap_failure).toMatchObject({
      reason: "not_written",
      trigger: "automatic",
    });
    expect((await status(page, id)).state).toBe("stopped");
    // Another restart derives the obligation again, not a saved failure.
    expect((await page.request.get("/fixture/pi-start-fail")).status()).toBe(
      204,
    );
    expect((await page.request.get("/fixture/daemon-restart")).status()).toBe(
      204,
    );
    await page.reload();
    await expect
      .poll(
        async () => {
          const native = await nativeRecap(page, id);
          return native.recap?.through === native.latest_message;
        },
        { timeout: 30000 },
      )
      .toBe(true);
    await expect(page.getByTestId("recap-failure")).not.toBeVisible();
    await expect(card(page)).toHaveAttribute("data-trigger", "automatic");
  } finally {
    await scenario(page, "ready");
  }
});

test("@recap an automatic recap whose delay outlasts the idle stop is made on the rested Pi", async ({
  page,
}) => {
  test.setTimeout(120000);
  try {
    // Jari 30.10.2026: a delay of 15 or 60 minutes outlasts Pi's ten idle
    // minutes. Here the delay outlasts the fixture's immediate idle stop.
    expect(
      (
        await page.request.get(
          "/fixture/scenario?value=pi-recap&recap_delay_ms=8000",
        )
      ).status(),
    ).toBe(204);
    // Taskfleet answers with no runs, so no run holds Pi from its idle stop.
    expect(
      (await page.request.get("/fixture/taskfleet?status=empty")).status(),
    ).toBe(204);
    const id = await answeredConversation(page, "ennen joutopysäytystä");
    const conversation = page.url();
    // The person has gone: nothing reports them in the conversation.
    await page.goto("/workspaces");
    const wakes = countWakes(page);
    // The idle stop passes a Pi still publishing its turn's settlement by.
    await expect
      .poll(async () => {
        expect((await page.request.get("/fixture/idle-stop")).status()).toBe(
          204,
        );
        return (await status(page, id)).state;
      })
      .toBe("stopped");
    expect((await nativeRecap(page, id)).recap).toBeNull();
    await expect
      .poll(
        async () => {
          const native = await nativeRecap(page, id);
          return native.recap?.through === native.latest_message
            ? native.recap.trigger
            : "";
        },
        { timeout: 40000 },
      )
      .toBe("automatic");
    await expect
      .poll(async () => (await status(page, id)).state, { timeout: 20000 })
      .toBe("stopped");
    // Pi was started only for the recap: the idle rest still holds and the
    // agent has not been woken.
    expect(wakes).toHaveLength(0);
    const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
    expect(
      snapshot.agents.find((a: { agent_id: string }) => a.agent_id === id)
        ?.rest,
    ).toMatchObject({ cause: "idle", awake: false });
    await page.goto(conversation);
    await expect(card(page)).toHaveAttribute("data-trigger", "automatic", {
      timeout: 20000,
    });
  } finally {
    await page.request.get("/fixture/taskfleet?status=none");
    await scenario(page, "ready");
  }
});
