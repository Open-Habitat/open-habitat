import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });
const agent = "pi:11111111-1111-4111-8111-111111111111";

test("@native-history terminal append reaches two browser contexts once without reload", async ({
  browser,
  page,
}) => {
  expect((await page.request.get("/fixture/history?mode=ready")).status()).toBe(
    204,
  );
  const secondContext = await browser.newContext({
    baseURL: hostOrigin,
    ignoreHTTPSErrors: true,
  });
  const second = await secondContext.newPage();
  try {
    for (const view of [page, second]) {
      await view.goto("/");
      await view
        .getByRole("button")
        .and(view.getByTestId("github-sign-in"))
        .click();
      await view
        .getByRole("link")
        .and(view.locator('a[href*="code=42"]'))
        .click();
      await view.goto(`/agents/${agent}`);
      await expect(view.locator(".ah-feed li")).toHaveCount(25);
    }
    expect(
      (await page.request.get("/fixture/history?mode=append")).status(),
    ).toBe(204);
    for (const view of [page, second]) {
      await expect
        .poll(() =>
          view
            .locator(".ah-feed li")
            .evaluateAll(
              (rows) =>
                rows.filter((row) =>
                  row.textContent?.includes("Ulkoinen terminaaliviesti"),
                ).length,
            ),
        )
        .toBe(1);
      await expect(view.locator(".ah-feed li")).toHaveCount(26);
    }
  } finally {
    await secondContext.close();
    await page.request.get("/fixture/history?mode=ready");
  }
});
