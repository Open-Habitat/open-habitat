import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

// Kortti (Jari 27.10.2026, proto-wake-stopped-agent round 2): a resting
// conversation shows Habitat's own report before anything starts; typing
// wakes Pi once without a turn, and the message ends the rest. These cases
// run the real gateway, daemon controller, its restart and the synthetic
// Taskfleet against the fake Pi.

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
const card = (page: Page) => page.getByTestId("rest-card");

async function status(page: Page, id: string) {
  const reply = await page.request.get(
    `/api/v1/conversations/${id.slice(3)}/status`,
  );
  return reply.ok() ? await reply.json() : { state: `http_${reply.status()}` };
}

async function snapshotRest(page: Page, id: string) {
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  return snapshot.agents.find((a: { agent_id: string }) => a.agent_id === id)
    ?.rest;
}

async function nativeUserTexts(page: Page, id: string) {
  const reply = await page.request.get(
    `/api/v1/agents/${id}/history?limit=100&after=`,
  );
  expect(reply.ok()).toBe(true);
  const body = await reply.json();
  return (body.entries as { kind: string; content?: { text?: string } }[])
    .filter((e) => e.kind === "user")
    .map((e) => e.content?.text ?? "");
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

test("@rest-card @a11y a resting conversation shows Habitat's report before any wake; typing wakes Pi once; the message ends the rest", async ({
  page,
}) => {
  test.setTimeout(120000);
  const id = await answeredConversation(page, "ennen lepoa");
  // A worker of this conversation settles while Pi is down.
  expect(
    (
      await page.request.get(
        `/fixture/taskfleet?parent=${id.slice(3)}&workspace=ordinary-dir&status=done`,
      )
    ).status(),
  ).toBe(204);
  expect((await page.request.get("/fixture/daemon-restart")).status()).toBe(
    204,
  );
  const wakes = countWakes(page);
  await page.reload();
  await expect(card(page)).toBeVisible({ timeout: 20000 });
  await expect(card(page)).toHaveAttribute("data-wake", "asleep");
  // Taskfleet's own report is shown as it is.
  await expect(card(page)).toContainText("Synteettinen spinoff.");
  expect(await snapshotRest(page, id)).toMatchObject({
    cause: "restart",
    awake: false,
  });
  // Opening and reading start nothing.
  await page.waitForTimeout(1000);
  expect((await status(page, id)).state).toBe("stopped");
  expect(wakes).toHaveLength(0);
  const axe = await new AxeBuilder({ page })
    .include('[data-testid="rest-card"]')
    .analyze();
  expect(axe.violations).toEqual([]);

  // The first character wakes Pi; more typing does not wake it again.
  await editor(page).pressSequentially("Jatka");
  await expect.poll(() => wakes.length).toBe(1);
  expect(wakes[0]).toBe(200);
  await expect(card(page)).toHaveAttribute("data-wake", "awake", {
    timeout: 20000,
  });
  expect((await status(page, id)).state).toBe("idle");
  await editor(page).pressSequentially(" siitä");
  await page.waitForTimeout(500);
  expect(wakes).toHaveLength(1);
  // Woken, not told: no turn ran.
  expect(await nativeUserTexts(page, id)).toEqual(["ennen lepoa"]);

  await send(page).click();
  await expect(page.locator("main")).toContainText('Kysyit: "Jatka siitä"', {
    timeout: 20000,
  });
  await expect(card(page)).toHaveCount(0);
  await expect.poll(() => snapshotRest(page, id)).toBeUndefined();
  expect(await nativeUserTexts(page, id)).toEqual([
    "ennen lepoa",
    "Jatka siitä",
  ]);
  expect(wakes).toHaveLength(1);
});

test("@rest-card a phone shows the card and the wake the same way", async ({
  page,
}) => {
  test.setTimeout(90000);
  const id = await answeredConversation(page, "puhelimella");
  expect((await page.request.get("/fixture/daemon-restart")).status()).toBe(
    204,
  );
  const wakes = countWakes(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(card(page)).toBeVisible({ timeout: 20000 });
  // The card fits the narrow column.
  const box = await card(page).boundingBox();
  expect(box?.width ?? 0).toBeLessThanOrEqual(390);
  await editor(page).pressSequentially("H");
  await expect(card(page)).toHaveAttribute("data-wake", "awake", {
    timeout: 20000,
  });
  expect(wakes).toEqual([200]);
  expect((await status(page, id)).state).toBe("idle");
});
