import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

// The conversation in English (en-conversation): a browser whose language is
// English, with nothing chosen, sees a turn, its work and the details in
// English. The rest of the suite runs these views in Finnish.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
  locale: "en-GB",
});

test.beforeEach(async ({ page }) => {
  expect((await page.request.get("/fixture/reset-clock")).status()).toBe(204);
  expect(
    (await page.request.get("/fixture/conversations-reset")).status(),
  ).toBe(204);
});

test("@ui-language-conversation a conversation, its turn and details read in English", async ({
  page,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-GB");
  await page.getByTestId("message-input").fill("Check the files");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();

  const turn = page.getByTestId("agent-turn").first();
  const stage = turn.getByTestId("history-stage-toggle").first();
  await expect(stage).toBeVisible({ timeout: 30000 });
  await expect(stage.locator(".ah-stage-sum")).toHaveText(
    /^\d+ (tools?|thoughts?)( · \d+ tools?)?$/,
  );
  await expect(
    page.getByTestId("message").first().locator("header strong"),
  ).toHaveText("You");
  await stage.click();
  const bash = turn
    .getByTestId("tool-row")
    .and(page.locator('[data-tool-name="bash"]'));
  await expect(bash).toContainText("done");

  await page
    .getByRole("button")
    .and(page.getByTestId("workspace-details"))
    .click();
  await expect(page.getByText("Native ID", { exact: true })).toBeVisible();
  await expect(page.getByText("Browser control").first()).toBeVisible();
  await expect(page.getByText("Natiivi tunniste")).toHaveCount(0);
});
