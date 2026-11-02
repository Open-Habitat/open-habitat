import AxeBuilder from "@axe-core/playwright";
import type { Browser } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
});
const conversationNow = (page: Page) =>
  new URL(page.url()).searchParams.get("conversation");
const line = (page: Page) => page.getByTestId("next-waiting");
async function send(page: Page, text: string) {
  await page.getByTestId("message-input").fill(text);
  await page.getByTestId("send").click();
}
async function create(page: Page) {
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  await expect(page.getByTestId("message-input")).toBeEnabled();
  return page.url();
}
async function switchOn(page: Page) {
  await page.getByTestId("account-menu-trigger").click();
  await page.getByTestId("menu-settings").click();
  await page
    .getByTestId("settings-navigation")
    .getByTestId("settings-kokeelliset")
    .click();
  const on = page
    .getByTestId("experimental-next-waiting-row-choice")
    .getByTestId("segment-on");
  await on.click();
  await expect(on).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("settings-close").click();
}
async function setup(page: Page, writer: Page, count = 2, enabled = true) {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await writer.goto(`${hostOrigin}/workspaces`);
  await writer.getByTestId("github-sign-in").click();
  await writer
    .getByRole("link")
    .and(writer.locator('a[href*="code=42"]'))
    .click();
  const hrefs: string[] = [];
  for (let i = 0; i < count; i++) {
    await writer.goto(`${hostOrigin}/workspaces`);
    hrefs.push(await create(writer));
    await send(writer, `reply ${i}`);
    await expect(
      page.getByTestId("rail-yours").getByTestId("agent-link"),
    ).toHaveCount(i + 1, { timeout: 25000 });
  }
  await page.bringToFront();
  const here = await create(page);
  if (enabled) await switchOn(page);
  return { here, hrefs };
}
// The replies are written on another machine: a tab of this browser that
// shows a reply as it ends has seen it for the whole browser.
async function elsewhere(browser: Browser) {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 900 },
  });
  return context.newPage();
}
async function hold(page: Page) {
  await page.request.get("/fixture/scenario?value=pi-visual-hold");
}
async function archiveOther(page: Page, href: string) {
  const id = new URL(href).searchParams.get("conversation");
  const row = page.getByRole("navigation").getByTestId(`agent-item-${id}`);
  await row.hover();
  await row.getByTestId("rail-archive-conversation").click();
  await expect(row).toHaveCount(0);
}

test("@next-waiting-row acceptance opens, live list empties and reopens, finish closes permanently", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  const writer = await elsewhere(browser);
  const { hrefs } = await setup(page, writer, 2, false);
  await hold(page);
  await send(page, "feature off");
  await expect(page.getByTestId("composer-stop")).toBeVisible();
  await expect(line(page)).toHaveCount(0);
  await page.request.get("/fixture/scenario?value=ready");
  await expect(page.getByTestId("composer-stop")).toHaveCount(0, {
    timeout: 30000,
  });
  await switchOn(page);
  await hold(page);
  // Delay only the POST reply: running alone must not open the window.
  let accept!: () => void;
  const gate = new Promise<void>((resolve) => {
    accept = resolve;
  });
  await page.route("**/api/v1/conversations/*/send", async (route) => {
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  });
  await send(page, "held turn");
  await expect(page.getByTestId("composer-stop")).toBeVisible();
  await expect(line(page)).toHaveCount(0);
  accept();
  await expect(line(page)).toHaveAttribute("data-waiting", "2");
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="next-waiting"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await archiveOther(page, hrefs[0]);
  await expect(line(page)).toHaveAttribute("data-waiting", "1");
  await archiveOther(page, hrefs[1]);
  await expect(line(page)).toHaveCount(0);
  // Keep this turn active in its validated status while the fixture releases
  // the writer. This tests the UI transition, not a second native Pi mode.
  let keepWorking = true;
  await page.route("**/api/v1/conversations/*/status", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (keepWorking) {
      body.run_active = true;
      body.turn_settled = null;
    }
    await route.fulfill({ response, json: body });
  });
  await writer.goto(`${hostOrigin}/workspaces`);
  const another = await create(writer);
  await page.request.get("/fixture/scenario?value=ready");
  await send(writer, "new reply");
  await expect(line(page)).toHaveAttribute("data-waiting", "1", {
    timeout: 25000,
  });
  keepWorking = false;
  await page.getByTestId("workspace-details").click();
  await page.getByTestId("conversation-recheck").click();
  await page.getByTestId("workspace-details").click();
  await expect(page.getByTestId("composer-stop")).toHaveCount(0, {
    timeout: 30000,
  });
  await expect(line(page)).toHaveCount(0);
  await hold(page);
  await send(page, "next turn");
  await expect(line(page)).toHaveAttribute("data-waiting", "1");
  await page.setViewportSize({ width: 390, height: 844 });
  const box = await line(page).boundingBox();
  expect(box?.width ?? 1000).toBeLessThanOrEqual(390);
  await page.getByTestId("next-open").click();
  await expect
    .poll(() => conversationNow(page))
    .toBe(new URL(another).searchParams.get("conversation"));
  await expect(line(page)).toHaveCount(0);
  await expect(page.getByTestId("next-queue")).toHaveCount(0);
  await writer.context().close();
});

test("@next-waiting-row next and rail departure do not carry a window, nor does reload or an external send", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  const writer = await elsewhere(browser);
  const { here } = await setup(page, writer);
  await hold(page);
  await send(page, "own turn");
  await expect(line(page)).toHaveAttribute("data-waiting", "2");
  const firstHref = await page
    .getByTestId("rail-yours")
    .getByTestId("agent-link")
    .first()
    .getAttribute("href");
  const firstId = new URL(firstHref ?? "", hostOrigin).searchParams.get(
    "conversation",
  );
  await page.getByTestId("message-input").focus();
  await page.keyboard.press("Alt+ArrowDown");
  await expect.poll(() => conversationNow(page)).toBe(firstId);
  await expect(line(page)).toHaveCount(0);
  await send(page, "answer here");
  await expect(line(page)).toHaveAttribute("data-waiting", "1");
  const hereId = new URL(here).searchParams.get("conversation");
  await page
    .getByRole("navigation")
    .getByTestId(`agent-item-${hereId}`)
    .getByTestId("agent-link")
    .click();
  await expect.poll(() => page.url()).toBe(here);
  await expect(line(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("message-input")).toBeVisible();
  await expect(line(page)).toHaveCount(0);
  await page.request.get("/fixture/scenario?value=ready");
  await expect(page.getByTestId("composer-stop")).toHaveCount(0, {
    timeout: 30000,
  });
  // A fresh unread reply after reload makes the no-window assertion
  // independent of how the rail restores its attention memory.
  await writer.goto(`${hostOrigin}/workspaces`);
  await create(writer);
  await send(writer, "waiting after reload");
  await expect(
    page.getByTestId("rail-yours").getByTestId("agent-link").first(),
  ).toBeVisible({ timeout: 25000 });
  await writer.goto(here);
  await expect(writer.getByTestId("message-input")).toBeEnabled();
  await hold(page);
  await send(writer, "external turn");
  await expect(page.getByTestId("composer-stop")).toBeVisible();
  await expect(line(page)).toHaveCount(0);
  await writer.context().close();
});

test("@next-waiting-row question, failed send and archive close the window", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  const writer = await elsewhere(browser);
  await setup(page, writer);
  await hold(page);
  await send(page, "own turn");
  await expect(line(page)).toHaveAttribute("data-waiting", "2");
  let asks = true;
  await page.route("**/api/v1/conversations/*/status", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    if (asks)
      body.pending_question = {
        request_id: "q",
        question_kind: "unknown",
        prompt: "question",
        choices: [],
      };
    await route.fulfill({ response, json: body });
  });
  await expect(page.getByTestId("agent-question")).toBeVisible();
  await expect(line(page)).toHaveCount(0);
  asks = false;
  await expect(page.getByTestId("agent-question")).toHaveCount(0);
  await expect(line(page)).toHaveCount(0);
  // A queued message is also a person's send; a refusal closes that window.
  await send(page, "queued");
  await expect(line(page)).toBeVisible();
  await page.route("**/api/v1/conversations/*/steer", (route) =>
    route.fulfill({ status: 409, body: "" }),
  );
  await send(page, "fails");
  await expect(line(page)).toHaveCount(0);
  await page.unrouteAll({ behavior: "wait" });
  await page.request.get("/fixture/scenario?value=ready");
  await expect(page.getByTestId("composer-stop")).toHaveCount(0, {
    timeout: 30000,
  });
  await hold(page);
  await send(page, "archive this");
  await expect(line(page)).toBeVisible();
  await page
    .locator(".ah-agent-header")
    .getByTestId("archive-conversation")
    .click();
  await expect(page.getByTestId("archive-notice")).toBeVisible();
  await expect(line(page)).toHaveCount(0);
  await writer.context().close();
});

test("@next-waiting-row off by default; a send with nobody waiting opens an empty window, reload forgets it", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  const writer = await elsewhere(browser);
  await setup(page, writer, 0, false);
  await hold(page);
  await send(page, "off by default");
  await expect(page.getByTestId("composer-stop")).toBeVisible();
  await expect(line(page)).toHaveCount(0);
  await switchOn(page);
  await send(page, "empty window");
  await expect(line(page)).toHaveCount(0);
  await page.route("**/api/v1/conversations/*/status", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.run_active = true;
    body.turn_settled = null;
    await route.fulfill({ response, json: body });
  });
  await page.request.get("/fixture/scenario?value=ready");
  await writer.goto(`${hostOrigin}/workspaces`);
  await create(writer);
  await send(writer, "first waiting reply");
  await expect(line(page)).toHaveAttribute("data-waiting", "1", {
    timeout: 25000,
  });
  await page.reload();
  await expect(page.getByTestId("message-input")).toBeVisible();
  await writer.goto(`${hostOrigin}/workspaces`);
  await create(writer);
  await send(writer, "another waiting reply after reload");
  await expect(
    page.getByTestId("rail-yours").getByTestId("agent-link").first(),
  ).toBeVisible({ timeout: 25000 });
  await expect(line(page)).toHaveCount(0);
  await writer.context().close();
});
