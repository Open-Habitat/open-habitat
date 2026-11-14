import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

test("@a11y unread replies wait in Sinun vuorosi, open by keyboard, and leave it only on Ei nyt", async ({
  page,
  browser,
}) => {
  test.setTimeout(60000);
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const yours = page
    .getByRole("navigation")
    .getByTestId("rail-yours")
    .getByRole("link")
    .and(page.getByTestId("agent-link"));
  // The replies are written on another machine: a tab of this browser that
  // shows a reply as it ends has seen it for the whole browser.
  const elsewhere = await browser.newContext({ ignoreHTTPSErrors: true });
  const writer = await elsewhere.newPage();
  await writer.goto(`${hostOrigin}/workspaces`);
  await writer.getByTestId("github-sign-in").click();
  await writer
    .getByRole("link")
    .and(writer.locator('a[href*="code=42"]'))
    .click();
  const urls: string[] = [];
  for (const message of ["first unseen reply", "second unseen reply"]) {
    await writer.goto(`${hostOrigin}/workspaces`);
    await writer
      .getByRole("navigation")
      .getByTestId("workspace-ordinary-dir")
      .click();
    await writer.getByTestId(/^(new-conversation|conversation-start)$/).click();
    await expect(writer).toHaveURL(/conversation=pi(?:%3A|:)/);
    await expect(
      writer
        .locator(".ah-agent-header")
        .getByTestId(/^(archive-conversation|dialog-close)$/),
    ).toBeVisible();
    urls.push(new URL(writer.url()).pathname + new URL(writer.url()).search);
    await writer.getByTestId("message-input").fill(message);
    await writer
      .getByTestId("send")
      .and(writer.locator('[data-mode="send"]'))
      .click();
    await expect(writer.getByTestId("message-input")).toBeEnabled();
    await expect(yours).toHaveCount(urls.length, { timeout: 25000 });
  }
  await elsewhere.close();
  await page.bringToFront();
  await expect(yours.nth(0)).toHaveAttribute("href", urls[0]);
  await expect(yours.nth(1)).toHaveAttribute("href", urls[1]);
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="workspace-navigation"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await yours.nth(0).focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(() => new URL(page.url()).searchParams.get("conversation"))
    .toBe(new URL(urls[0], hostOrigin).searchParams.get("conversation"));
  // Opened, the reply is read but still the person's turn until they answer
  // or say Ei nyt (raise-to-your-turn, default since 8.11.); the other one is
  // still news. Its turn has ended, so it is not in Käynnissä either.
  const ball = (url: string) =>
    page
      .getByRole("navigation")
      .getByTestId(
        `agent-item-${new URL(url, hostOrigin).searchParams.get("conversation")}`,
      )
      .getByTestId("rail-mark");
  await expect(yours).toHaveCount(2);
  await expect(ball(urls[0])).toHaveAttribute("data-state", "read");
  await expect(ball(urls[1])).not.toHaveAttribute("data-state", "read");
  await expect(
    page.getByTestId("rail-running").locator(`a[href="${urls[0]}"]`),
  ).toHaveCount(0);
  await expect(page.getByTestId("message-input")).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId("navigation-badge")).toBeVisible();
  await page.getByTestId("navigation-open").click();
  const second = yours.and(page.locator(`a[href="${urls[1]}"]`));
  await expect(second).toBeVisible();
  await second.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("message-input")).toBeFocused();
  // Ei nyt from each row empties Sinun vuorosi and the badge with it.
  await page.getByTestId("navigation-open").click();
  await expect(ball(urls[1])).toHaveAttribute("data-state", "read");
  for (const url of urls) {
    const row = page
      .getByRole("navigation")
      .getByTestId("rail-yours")
      .getByTestId(
        `agent-item-${new URL(url, hostOrigin).searchParams.get("conversation")}`,
      );
    await row.hover();
    await row.getByTestId("rail-not-now-conversation").click();
    await expect(row).toHaveCount(0);
  }
  await expect(yours).toHaveCount(0);
  await expect(page.getByTestId("navigation-badge")).toHaveCount(0);
});
