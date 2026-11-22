import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { openedConversation } from "./conversation-view";
import { expect, type Page, test } from "./worker-host";

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 800 },
});

test.beforeEach(async ({ page }) => {
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  await page.request.get("/fixture/pi-state?value=usable");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.getByTestId("rail-resources")).toBeVisible();
});

async function openWorkspace(page: Page) {
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
}

test("places toggle and switch over the same conversation, including Back and Forward", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await openWorkspace(page);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await openedConversation(page);
  const input = page.getByTestId("message-input");
  await input.fill(
    Array.from({ length: 40 }, (_, i) => `Synthetic line ${i}`).join("\n"),
  );
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(input).toHaveValue("");
  const id = new URL(page.url()).searchParams.get("conversation");
  if (!id) throw new Error("missing conversation id");
  await expect
    .poll(async () => {
      const status = await (
        await page.request.get(`/api/v1/conversations/${id.slice(3)}/status`)
      ).json();
      return status.state === "idle" && status.native_history === "present";
    })
    .toBe(true);
  await input.fill("Draft kept across a visit");
  const url = page.url();
  const frame = page.locator(".ah-conversation-frame");
  await frame.evaluate((el) => el.setAttribute("data-kept", "yes"));
  const stream = page.getByTestId("conversation-stream");
  await expect
    .poll(() => stream.evaluate((el) => el.scrollHeight - el.clientHeight))
    .toBeGreaterThan(100);
  const bottom = await stream.evaluate((el) => el.scrollTop);
  await stream.hover();
  await page.mouse.wheel(0, -100);
  await expect
    .poll(() => stream.evaluate((el) => el.scrollTop))
    .toBeLessThan(bottom);
  const scroll = await stream.evaluate((el) => el.scrollTop);
  const same = async () => {
    await expect(page).toHaveURL(url);
    await expect(
      page.locator('.ah-conversation-frame[data-kept="yes"]'),
    ).toBeVisible();
    await expect(input).toHaveValue("Draft kept across a visit");
    await expect
      .poll(() => stream.evaluate((el) => el.scrollTop))
      .toBeCloseTo(scroll, 0);
  };
  await page.getByTestId("rail-shares").click();
  await expect(page.getByTestId("shares-page")).toBeVisible();
  await expect(frame).toBeHidden();
  await expect(page.getByTestId("rail-shares")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByTestId("rail-resources").click();
  await expect(page.getByTestId("agent-resources")).toBeVisible();
  await page.getByTestId("rail-resources").click();
  await same();
  await page.getByTestId("rail-resources").click();
  await page.goBack();
  await same();
  await page.goForward();
  await expect(page).toHaveURL(/\/resources$/);
  await page.goBack();
  await same();
  await page.getByTestId("rail-shares").click();
  await page.keyboard.press("Escape");
  await same();
  await page.getByTestId("rail-shares").click();
  await page.getByTestId("rail-shares").click();
  await same();
});

test("workspace scroll survives a place; Home is not a toggle; deep links close safely", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 360 });
  await openWorkspace(page);
  const url = page.url();
  const main = page.locator("#main");
  await expect
    .poll(() => main.evaluate((el) => el.scrollHeight - el.clientHeight))
    .toBeGreaterThan(40);
  await main.evaluate((el) => {
    el.scrollTop = 40;
  });
  await page.getByTestId("rail-resources").click();
  await expect(page.getByTestId("agent-resources")).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(url);
  expect(await main.evaluate((el) => el.scrollTop)).toBe(40);
  await page.goto("/shares");
  await expect(page.getByTestId("shares-page")).toBeVisible();
  await page.getByTestId("rail-shares").click();
  await expect(page).toHaveURL(/\/workspaces$/);
  const home = page.locator('.ah-rail-home[href="/workspaces"]');
  await home.click();
  await home.click();
  await expect(page).toHaveURL(/\/workspaces$/);
});
