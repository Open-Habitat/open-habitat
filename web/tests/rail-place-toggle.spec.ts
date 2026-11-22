import fs from "node:fs/promises";
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
  if (process.env.OH_VISUAL_CAPTURE) {
    const out = "/var/tmp/agent-keep/rail-place-button-toggles-back";
    await fs.mkdir(out, { recursive: true });
    await expect(
      page.getByTestId("shares-page").getByRole("heading", { level: 1 }),
    ).toBeVisible();
    await page.screenshot({ path: `${out}/shares-desktop.png` });
    await fs.writeFile(`${out}/shares-desktop.html`, await page.content());
  }
  await expect(page.getByTestId("rail-shares")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByTestId("rail-resources").click();
  await expect(page.getByTestId("agent-resources")).toBeVisible();
  await page.getByTestId("place-close").click();
  await same();
  await page.getByTestId("rail-shares").click();
  await page.getByTestId("place-close").click();
  await same();
  await page.getByTestId("rail-resources").click();
  await page.goBack();
  await same();
  await page.goForward();
  await expect(page).toHaveURL(/\/resources$/);
  await page.goBack();
  await same();
  await page.getByTestId("rail-shares").click();
  await expect(page.getByTestId("shares-page")).toBeVisible();
  await expect(page.locator(".ah-place-layer")).toBeFocused();
  await page.keyboard.press("Escape");
  await same();
  await page.getByTestId("rail-shares").click();
  await expect(page.getByTestId("shares-page")).toBeVisible();
  // A settings visit must not become the place's return destination.
  await page.getByTestId("account-menu-trigger").click();
  await page.getByTestId("menu-settings").click();
  await expect(page.getByTestId("settings-close")).toBeVisible();
  await page.getByTestId("settings-close").click();
  await expect(page.getByTestId("shares-page")).toBeVisible();
  await page.getByTestId("rail-shares").click();
  await same();
  await page.locator(".ah-agent-header").getByTestId("context-ring").click();
  await expect(page.getByTestId("context-page")).toBeVisible();
  await page.getByTestId("rail-resources").click();
  await expect(page.locator(".ah-place-layer")).toBeVisible();
  await page.getByTestId("rail-resources").click();
  await expect(page.getByTestId("context-page")).toBeVisible();
  await page.getByTestId("context-back").click();
  await expect(page).toHaveURL(
    (actual) =>
      actual.pathname === new URL(url).pathname &&
      actual.searchParams.get("conversation") === id &&
      !actual.searchParams.has("context"),
  );
  const returnURL = page.url();
  await page.getByTestId("rail-shares").click();
  await expect(page.locator(".ah-place-layer")).toBeVisible();
  const row = page.getByRole("navigation").getByTestId(`agent-item-${id}`);
  await row.hover();
  await row.getByTestId("rail-archive-conversation").click();
  const accept = page.getByTestId("helper-archive-accept");
  await expect(page.getByTestId("archive-notice").or(accept)).toBeVisible();
  if (await accept.isVisible()) await accept.click();
  await expect(page.getByTestId("archive-notice")).toBeVisible();
  await page.getByTestId("restore-notice").click();
  await expect(page).toHaveURL(returnURL);
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
  for (const path of ["/shares", "/resources"]) {
    await page.goto(path);
    await page.getByTestId("place-close").click();
    await expect(page).toHaveURL(/\/workspaces$/);
  }
  await page.goto("/shares");
  await expect(page.getByTestId("shares-page")).toBeVisible();
  await page.getByTestId("rail-shares").click();
  await expect(page).toHaveURL(/\/workspaces$/);
  const home = page.locator('.ah-rail-home[href="/workspaces"]');
  await home.click();
  await home.click();
  await expect(page).toHaveURL(/\/workspaces$/);
});

test("phone navigation can close the open place without losing the workspace", async ({
  page,
}) => {
  await openWorkspace(page);
  const url = page.url();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("navigation-open").click();
  await page.getByTestId("rail-resources").click();
  await expect(page.getByTestId("agent-resources")).toBeVisible();
  if (process.env.OH_VISUAL_CAPTURE) {
    const out = "/var/tmp/agent-keep/rail-place-button-toggles-back";
    await fs.mkdir(out, { recursive: true });
    await expect(page.getByTestId("resource-summary")).toBeVisible();
    await page.screenshot({ path: `${out}/resources-phone.png` });
    await fs.writeFile(`${out}/resources-phone.html`, await page.content());
  }
  await page.getByTestId("navigation-open").click();
  await expect(page.getByTestId("rail-resources")).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.getByTestId("rail-resources").click();
  await expect(page).toHaveURL(url);
  await expect(page.getByTestId("agent-resources")).toHaveCount(0);
  await page.getByTestId("navigation-open").click();
  await page.getByTestId("rail-resources").click();
  await page.getByTestId("place-close").click();
  await expect(page).toHaveURL(url);
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await openedConversation(page);
  await page.getByTestId("message-input").fill("Phone draft");
  const conversation = page.url();
  await page.getByTestId("navigation-open").click();
  await page.getByTestId("rail-shares").click();
  await expect(page.getByTestId("shares-page")).toBeVisible();
  await page.getByTestId("place-close").click();
  await expect(page).toHaveURL(conversation);
  await expect(page.getByTestId("message-input")).toHaveValue("Phone draft");
});

test("creation finishing underneath a place does not close the visit", async ({
  page,
}) => {
  await openWorkspace(page);
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let fetched = false;
  await page.route("**/api/v1/conversations", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const response = await route.fetch();
    fetched = true;
    await held;
    await route.fulfill({ response });
  });
  try {
    await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
    await expect.poll(() => fetched).toBe(true);
    await page.getByTestId("rail-resources").click();
    await expect(page.locator(".ah-place-layer")).toBeVisible();
    const observed = page.waitForRequest((request) =>
      /\/api\/v1\/conversations\/[^/]+\/status/.test(request.url()),
    );
    release();
    // Binding the returned session starts its status read under the place.
    await observed;
    await expect(page.locator(".ah-place-layer")).toBeVisible();
    await page.getByTestId("rail-resources").click();
    await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
    await expect(page.getByTestId("message-input")).toBeEnabled();
  } finally {
    release();
  }
});

test("a remembered place background never hides sign-in after session expiry", async ({
  page,
}) => {
  await openWorkspace(page);
  await page.getByTestId("rail-resources").click();
  await expect(page.locator(".ah-place-layer")).toBeVisible();
  expect((await page.request.get("/fixture/expire")).status()).toBe(204);
  await page.reload();
  await expect(page.getByTestId("github-sign-in")).toBeVisible();
  await expect(page.locator(".ah-place-layer")).toHaveCount(0);
  await expect(page.locator("[data-under-place]")).toHaveCount(0);
});
