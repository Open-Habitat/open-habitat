import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

async function agentRow(page: Page, id: string) {
  const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
  return snapshot.agents.find((a: { agent_id: string }) => a.agent_id === id);
}

async function status(page: Page, id: string) {
  const reply = await page.request.get(
    `/api/v1/conversations/${id.slice(3)}/status`,
  );
  expect(reply.ok()).toBe(true);
  return reply.json();
}

// rail-interrupted-turn-hidden (Jari 31.10.): an upgrade restarted the daemon
// in the middle of a turn. The conversation's native branch ends without the
// model's answer, so the host says the turn was cut, and the rail keeps it in
// sight as cut off until the person continues it from the rest card.
test("@rail-interrupted-turn a turn cut by a daemon restart stays in the rail as cut off until continued", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const nav = page.getByTestId("workspace-navigation");
  const running = nav.getByTestId("rail-running");
  await nav.getByTestId("workspace-ordinary-dir").click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  const id = new URL(page.url()).searchParams.get("conversation") ?? "";
  const url = page.url();
  const send = async (text: string) => {
    await page.getByTestId("message-input").fill(text);
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
  };
  const row = running.getByTestId(`agent-item-${id}`);

  await send("hidas työ");
  await expect(row).toHaveAttribute("data-ball", "work", { timeout: 25000 });
  // The upgrade: the daemon restarts while the turn works.
  expect((await page.request.get("/fixture/daemon-restart")).status()).toBe(
    204,
  );
  // Elsewhere, the rail shows the cut conversation as needing a look.
  await page.goto("/workspaces");
  await expect(row).toHaveAttribute("data-ball", "fail", { timeout: 20000 });
  await expect(row).toContainText("Työ katkesi kesken");
  expect(await agentRow(page, id)).toMatchObject({
    rest: { cause: "restart", awake: false },
    interrupted_turn: true,
  });
  expect(await status(page, id)).toMatchObject({
    state: "stopped",
    run_active: false,
    interrupted_turn: true,
  });
  // A refreshed snapshot keeps it there; it never sinks among the quiet.
  await nav.getByTestId("snapshot-refresh").click();
  await expect(row).toHaveAttribute("data-ball", "fail");

  // Opening it shows Habitat's rest card, which says the work was cut and
  // that writing continues it.
  await row.getByRole("link").first().click();
  await expect(page).toHaveURL(url);
  const card = page.getByTestId("rest-card");
  await expect(card).toBeVisible({ timeout: 20000 });
  await expect(card).toContainText("Agentin kesken ollut työ katkesi.");
  await expect(card).toHaveAttribute("data-wake", "asleep");

  // The person continues: the rest ends, and with it the cut.
  await send("Jatka siitä");
  await expect(page.getByTestId("message-input")).toBeEnabled({
    timeout: 25000,
  });
  await expect(card).toHaveCount(0, { timeout: 25000 });
  await expect(row).toHaveCount(0, { timeout: 25000 });
  await expect
    .poll(async () => (await agentRow(page, id))?.interrupted_turn)
    .toBeUndefined();
  expect((await status(page, id)).interrupted_turn).toBe(false);
});
