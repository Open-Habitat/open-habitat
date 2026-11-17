import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});

// The agent places its own conversation after its reply (agent section
// update --current, here driven by the fixture as the conversation's Pi
// would run it during its turn). The choice belongs to that turn: the next
// one is judged afresh, and the person's Nosta wins over it.
const row = (page: Page, section: string, id: string) =>
  page.getByTestId(section).getByTestId(`agent-item-${id}`);

async function choose(page: Page, id: string, section: string) {
  // The turn is running once the stop button shows; the daemon accepts the
  // choice only during the conversation's own running turn.
  await expect
    .poll(
      async () =>
        (
          await page.request.get(
            `/fixture/agent-section?id=${encodeURIComponent(id)}&section=${section}`,
          )
        ).status(),
      { timeout: 15000 },
    )
    .toBe(204);
}

test("@agent-section the agent's quiet choice holds its reply in Hiljaiset until the next turn", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto(`${hostOrigin}/workspaces`);
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  const id = new URL(page.url()).searchParams.get("conversation") ?? "";

  await page.getByTestId("message-input").fill("hidas laita hiljaisiin");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("composer-stop")).toBeVisible();
  await choose(page, id, "quiet");
  await expect(page.getByTestId("composer-stop")).toHaveCount(0, {
    timeout: 60000,
  });
  // Without the choice a finished reply waits in Sinun vuorosi.
  await expect(row(page, "rail-quiet", id)).toBeVisible();
  await expect(row(page, "rail-yours", id)).toHaveCount(0);
  // It stays there through a reload: the person's daemon keeps the choice.
  await page.reload();
  await expect(row(page, "rail-quiet", id)).toBeVisible({ timeout: 15000 });

  // The person's own Nosta wins over the agent's choice.
  const quiet = row(page, "rail-quiet", id);
  await quiet.hover();
  await quiet.getByTestId("rail-raise-conversation").click();
  await expect(row(page, "rail-yours", id)).toBeVisible();
  await page.getByTestId("rail-yours").getByTestId(`agent-item-${id}`).hover();
  await row(page, "rail-yours", id)
    .getByTestId("rail-lower-conversation")
    .click();
  await expect(row(page, "rail-quiet", id)).toBeVisible();

  // The person writes: a new turn, whose reply claims their turn as usual.
  await page.getByTestId("message-input").fill("toinen");
  await page.getByTestId("send").click();
  await expect(page.getByTestId("composer-stop")).toHaveCount(0, {
    timeout: 30000,
  });
  await expect(row(page, "rail-yours", id)).toBeVisible({ timeout: 15000 });
});
