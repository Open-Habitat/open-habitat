import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

for (const credential of ["oauth", "key"]) {
  test(`refused ${credential} is a failed turn live and after reload, not running work`, async ({
    page,
  }) => {
    await page.request.get("/fixture/conversations-reset");
    await page.request.get("/fixture/scenario?value=ready");
    await page.goto("/workspaces");
    await page.getByTestId("github-sign-in").click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=42"]'))
      .click();
    const nav = page.getByTestId("workspace-navigation");
    await nav.getByTestId("workspace-ordinary-dir").click();
    await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
    await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
    const id = new URL(page.url()).searchParams.get("conversation");
    await page.getByTestId("message-input").fill(`auth-failure-${credential}`);
    await page
      .getByTestId("send")
      .and(page.locator('[data-mode="send"]'))
      .click();
    const verify = async () => {
      const turn = page.getByTestId("agent-turn").last();
      // A refused sign-in is one short row (ai-sign-in-window.spec.ts).
      await expect(turn.getByTestId("turn-short")).toHaveText(
        /^Claude-kirjautuminen on vanhentunut\./,
      );
      await expect(turn.locator('[data-reply-complete="true"]')).toHaveCount(0);
      await expect(nav.getByTestId(`agent-item-${id}`)).toHaveAttribute(
        "data-ball",
        "fail",
      );
      await expect(
        nav.getByTestId("rail-running").getByTestId(`agent-item-${id}`),
      ).toHaveCount(0);
    };
    await verify();
    await page.reload();
    await verify();
  });
}
