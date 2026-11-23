import type { Browser } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// The attention sound on the device in use (sounds-active-device,
// experimental): the same person has Habitat open on two devices, here two
// browser contexts with their own storage, signed in as the same synthetic
// person. The real daemon decides which tab plays. Headless Chromium has no
// ears, so each page's own record of what it started is what is read.
const options = {
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
  locale: "fi-FI",
  timezoneId: "Europe/Helsinki",
  reducedMotion: "reduce" as const,
};
test.use(options);

async function signIn(page: Page) {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(page.getByTestId("workspace-navigation")).toBeVisible();
}
async function headers(page: Page) {
  const s = await (await page.request.get("/auth/session")).json();
  return { Origin: new URL(page.url()).origin, "X-Agent-Host-CSRF": s.csrf };
}
async function prefer(page: Page, data: object) {
  const put = await page.request.put("/api/v1/account/preferences", {
    headers: await headers(page),
    data,
  });
  expect(put.status()).toBe(200);
}
const plays = (page: Page) =>
  page.evaluate(() => (window.__ohSoundPlays ?? []).map((p) => p.id));

/** Two devices of one person, both on the rail with nothing selected, past
 * the settle window, with a conversation of theirs running. Returns the
 * conversation's id. */
async function twoDevices(browser: Browser, page: Page, feature: boolean) {
  await page.request.get("/fixture/conversations-reset");
  await page.request.get("/fixture/scenario?value=ready");
  await page.clock.install();
  await signIn(page);
  await prefer(page, { sound: { night: false } });
  await prefer(page, { experimental: { "sounds-active-device": feature } });
  const other = await browser.newContext(options);
  const laptop = await other.newPage();
  await laptop.clock.install();
  await signIn(laptop);

  await page
    .getByTestId("workspace-navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  const agent = new URL(page.url()).searchParams.get("conversation") ?? "";
  await page.request.get("/fixture/scenario?value=pi-visual-hold");
  await page.getByTestId("message-input").fill("työ");
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  // Neither device has the conversation in view when its reply arrives.
  await page.goto("/workspaces");
  for (const device of [page, laptop]) {
    await expect(
      device
        .getByTestId("workspace-navigation")
        .getByTestId("rail-running")
        .getByTestId(`agent-item-${agent}`),
    ).toBeVisible({ timeout: 25000 });
    await device.clock.fastForward(5000);
  }
  return { laptop, agent, close: () => other.close() };
}

async function reply(devices: Page[], agent: string) {
  await devices[0].request.get("/fixture/scenario?value=ready");
  for (const device of devices)
    await expect(
      device
        .getByTestId("workspace-navigation")
        .getByTestId("rail-yours")
        .getByTestId(`agent-item-${agent}`),
    ).toBeVisible({ timeout: 25000 });
}

test("@attention-sound only the device with the latest input plays", async ({
  browser,
  page,
}) => {
  const { laptop, agent, close } = await twoDevices(browser, page, true);
  // Input on the desktop, then, well past the tie margin, on the laptop.
  await page.keyboard.press("Shift");
  await page.waitForTimeout(1500);
  await laptop.keyboard.press("Shift");
  await reply([page, laptop], agent);
  await expect.poll(() => plays(laptop), { timeout: 10000 }).toHaveLength(1);
  // The desktop asked too and was told to stay quiet.
  await page.waitForTimeout(1000);
  expect(await plays(page)).toEqual([]);
  await close();
});

test("@attention-sound every device plays after five minutes without input", async ({
  browser,
  page,
}) => {
  const { laptop, agent, close } = await twoDevices(browser, page, true);
  // The fake clock moves the pages' time, not the daemon's: each page has
  // input of its own, so its heartbeat can say how long it has been idle.
  await page.keyboard.press("Shift");
  await laptop.keyboard.press("Shift");
  for (const device of [page, laptop]) await device.clock.fastForward("05:30");
  await reply([page, laptop], agent);
  for (const device of [page, laptop])
    await expect.poll(() => plays(device), { timeout: 10000 }).toHaveLength(1);
  await close();
});

test("@attention-sound with the feature off every device plays as before", async ({
  browser,
  page,
}) => {
  const { laptop, agent, close } = await twoDevices(browser, page, false);
  await laptop.keyboard.press("Shift");
  await reply([page, laptop], agent);
  for (const device of [page, laptop])
    await expect.poll(() => plays(device), { timeout: 10000 }).toHaveLength(1);
  await close();
});
