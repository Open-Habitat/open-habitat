import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { archiveFromConfirmedView } from "./archive-proof";
import { expect, test } from "./worker-host";

const agent = "pi:11111111-1111-4111-8111-111111111111";
test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });

test("damaged archive restore gives a dismissible refusal confined to its view", async ({
  page,
}) => {
  test.setTimeout(60000);
  expect((await page.request.get("/fixture/history?mode=ready")).status()).toBe(
    204,
  );
  await page.goto("/");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page.goto(`/agents/${agent}`);
  const header = page.locator(".ah-agent-header");
  await archiveFromConfirmedView(page, () =>
    header.getByTestId("archive-conversation"),
  );
  await page.goto(`/agents/${agent}`);
  const restore = header
    .getByTestId("restore-conversation")
    .or(
      header
        .getByTestId("archive-conversation")
        .and(page.locator('[data-archive-state="archived"]')),
    );
  await expect(restore).toBeEnabled();
  expect(
    (await page.request.get("/fixture/history?mode=corrupt")).status(),
  ).toBe(204);
  const refuse = async () => {
    const reply = page.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        new URL(r.url()).pathname === "/api/v1/workspaces",
    );
    await restore.click();
    const response = await reply;
    expect(response.status()).toBe(409);
    expect((await response.json()).error.code).toBe("history_damaged");
    await expect(page.getByTestId("archive-error")).toBeVisible();
  };
  await refuse();
  const notice = page.getByTestId("archive-notice");
  await expect(notice.getByTestId("restore-notice")).toHaveCount(0);
  const axe = await new AxeBuilder({ page })
    .include('[data-testid="archive-notice"]')
    .analyze();
  expect(axe.violations).toEqual([]);
  await notice.getByTestId("notice-close").click();
  await expect(page.getByTestId("archive-error")).toHaveCount(0);
  await refuse();
  // Client-side navigation, not a reload that would erase all app state.
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi:/);
  await expect(page.getByTestId("archive-notice")).toHaveCount(0);
  await expect(page.getByTestId("archive-error")).toHaveCount(0);
});
