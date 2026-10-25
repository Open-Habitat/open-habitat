import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

test("@a11y unread rail link opens replies by keyboard, then clears only the opened reply", async ({
  page,
  context,
}) => {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  const writer = await context.newPage();
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
    await expect(page.getByTestId("unread-replies")).toBeVisible({
      timeout: 25000,
    });
  }
  await writer.close();
  await page.bringToFront();
  const link = page.getByRole("link").and(page.getByTestId("unread-replies"));
  await expect(link).toHaveAttribute("href", urls[0]);
  // This checks the dynamic count, not Finnish copy.
  await expect(link).toHaveAccessibleName(/2/);
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="workspace-navigation"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await link.focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(() => new URL(page.url()).searchParams.get("conversation"))
    .toBe(new URL(urls[0], hostOrigin).searchParams.get("conversation"));
  await expect(link).toHaveAttribute("href", urls[1]);
  await expect(link).toHaveAccessibleName(/1/);
  await expect(page.getByTestId("message-input")).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("navigation-open").click();
  await expect(link).toBeVisible();
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("unread-replies")).toHaveCount(0);
  await expect(page.getByTestId("message-input")).toBeFocused();
});
