import { expect, test } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";

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
      await view.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
      await view.getByRole("link", { name: "Alice" }).click();
      await view.goto(`/agents/${agent}`);
      await expect(view.locator(".ah-feed li")).toHaveCount(25);
    }
    expect(
      (await page.request.get("/fixture/history?mode=append")).status(),
    ).toBe(204);
    for (const view of [page, second]) {
      await expect(
        view
          .locator(".ah-feed")
          .getByText("Ulkoinen terminaaliviesti", { exact: true }),
      ).toHaveCount(1);
      await expect(view.locator(".ah-feed li")).toHaveCount(25);
    }
  } finally {
    await secondContext.close();
    await page.request.get("/fixture/history?mode=ready");
  }
});
