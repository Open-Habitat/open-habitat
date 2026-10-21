import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

test("@browser-conversation repeated completed turns do not become Pi messages", async ({
  page,
}) => {
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.locator('a[href*="code=42"]').click();
  await page
    .getByRole("navigation")
    .locator('a[data-testid^="workspace-"][data-workspace-name="ordinary-dir"]')
    .click();
  await page.getByTestId("conversation-start").click();
  for (let i = 1; i <= 4; i++) {
    await page.getByTestId("message-input").fill(`Vuoro ${i}`);
    await page.getByTestId("send").click();
    await expect(page.locator("main")).toContainText(
      `Selvä. Kysyit: "Vuoro ${i}".`,
      { timeout: 15_000 },
    );
    await expect(page.getByTestId("composer-stop")).toHaveCount(0);
    await expect(page.locator('[data-testid="unpresented-event"]')).toHaveCount(
      0,
    );
  }
  await page.reload();
  await expect(page.locator('[data-testid="unpresented-event"]')).toHaveCount(
    0,
  );
});
