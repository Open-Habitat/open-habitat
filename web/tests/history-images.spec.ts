import { hostOrigin } from "../test-ports.mjs";
import { expect, test } from "./worker-host";

const agent = "pi:11111111-1111-4111-8111-111111111111";
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1000, height: 800 },
  deviceScaleFactor: 2,
});

// SHOT_DIR keeps the before/after evidence of a visual change.
const shot = async (
  locator: import("@playwright/test").Locator,
  name: string,
) =>
  process.env.SHOT_DIR
    ? void (await locator.screenshot({
        path: `${process.env.SHOT_DIR}/${name}.png`,
      }))
    : undefined;

test("own image attachment shows once; a tool's image stays within bounds", async ({
  page,
}) => {
  expect(
    (await page.request.get("/fixture/history?mode=images")).status(),
  ).toBe(204);
  await page.goto("/");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page.goto(`/agents/${agent}`);
  const own = page.locator('.ah-feed > li[data-kind="user"]');
  await expect(own.getByTestId("attachment-chip")).toHaveCount(1);
  await expect(own.locator(".ah-attachment-chips img")).toBeVisible();
  // The native image block Pi received is the same attachment as the chip.
  await expect(own.getByTestId("history-block-load")).toHaveCount(0);
  await expect(own).not.toContainText("image/png");
  await shot(own, "own-message");

  await page.getByRole("button", { name: "1 työkalu" }).click();
  await page.getByTestId("history-tool-toggle").first().click();
  const load = page.locator(
    'div:has(> p:text-is("Kuva · image/png")) > [data-testid="history-block-load"]',
  );
  await expect(load).toHaveCount(1);
  await load.click();
  const image = page.locator(".ah-feed img.ah-history-image");
  await expect(image).toBeVisible();
  const [box, feed] = await Promise.all([
    image.boundingBox(),
    page.locator(".ah-feed").boundingBox(),
  ]);
  expect(box && feed).toBeTruthy();
  expect(box?.height).toBeLessThanOrEqual(320);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
    (feed?.x ?? 0) + (feed?.width ?? 0),
  );
  await shot(image.locator(".."), "tool-image");
});
