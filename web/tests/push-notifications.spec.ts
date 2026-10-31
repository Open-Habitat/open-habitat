import { writeFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Ilmoitus puhelimeen, kun on vuorosi (push-when-your-turn, experimental):
// the card subscribes this device, the person's daemon sends to the host's
// fake push service when a conversation becomes their turn while they are
// away, once per conversation until they come back, and the device list
// removes and tests. Chromium's own push service is out of reach here, so
// the page's PushManager and service worker registration are replaced by a
// fake whose subscription keys the host can decrypt with.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
});

const evidence = "../issues/push-when-your-turn/evidence";
const capture = !!process.env.OH_VISUAL_CAPTURE;

type Subscription = { endpoint: string; p256dh: string; auth: string };
type Sent = {
  endpoint: string;
  ttl: string;
  topic: string;
  urgency: string;
  payload: Record<string, unknown> | null;
};

/** Runs in the page before the app: notification permission, a push
 * manager and a service worker registration, and a way to hide the tab. */
function fakePush(sub: Subscription) {
  const w = window as unknown as Record<string, unknown>;
  w.__ohHidden = false;
  Object.defineProperty(document, "visibilityState", {
    get: () => (w.__ohHidden ? "hidden" : "visible"),
  });
  let permission: NotificationPermission = "default";
  w.Notification = {
    get permission() {
      return permission;
    },
    async requestPermission() {
      permission = "granted";
      return permission;
    },
  };
  let current: unknown = null;
  const manager = {
    async getSubscription() {
      return current;
    },
    async subscribe(options: { applicationServerKey: Uint8Array }) {
      const key = options.applicationServerKey.slice().buffer;
      current = {
        endpoint: sub.endpoint,
        options: { applicationServerKey: key, userVisibleOnly: true },
        toJSON: () => ({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        }),
        async unsubscribe() {
          current = null;
          return true;
        },
      };
      return current;
    },
  };
  w.PushManager = function PushManager() {};
  const registration = {
    pushManager: manager,
    async getNotifications() {
      return [];
    },
  };
  const container = new EventTarget() as EventTarget & Record<string, unknown>;
  container.register = async () => registration;
  container.getRegistration = async () => registration;
  container.ready = Promise.resolve(registration);
  Object.defineProperty(navigator, "serviceWorker", { get: () => container });
  w.__ohSubscribed = () => current !== null;
  w.__ohTap = (url: string) =>
    container.dispatchEvent(
      new MessageEvent("message", { data: { type: "open-habitat.open", url } }),
    );
}

async function sent(page: Page): Promise<Sent[]> {
  return (await page.request.get("/fixture/push")).json();
}

async function signIn(page: Page) {
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeAttached();
}

const card = (page: Page) =>
  page
    .getByRole("region")
    .and(page.getByTestId("experimental-push-when-your-turn"));
const segment = (page: Page, value: "on" | "off") =>
  card(page)
    .getByRole("group")
    .and(page.getByTestId("experimental-push-when-your-turn-choice"))
    .getByRole("button")
    .and(page.getByTestId(`segment-${value}`));

async function send(page: Page, message: string) {
  await page.getByTestId("message-input").fill(message);
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  await expect(page.getByTestId("message-input")).toHaveValue("");
}

async function snapshot(page: Page, name: string) {
  if (!capture) return;
  await card(page).screenshot({ path: `${evidence}/${name}.png` });
  writeFileSync(`${evidence}/${name}.html`, await page.content());
}

test("@push-when-your-turn the card subscribes this device and a turn notifies the phone once while the person is away", async ({
  page,
  browser,
}) => {
  test.setTimeout(180000);
  await page.request.get("/fixture/scenario?value=ready");
  const sub: Subscription = await (
    await page.request.get("/fixture/push-subscription?user=alice")
  ).json();
  await page.addInitScript(fakePush, sub);
  await signIn(page);
  await page.goto("/settings/experimental");

  // Off: no device panel. On: permission asked in the press, this device
  // subscribed and listed as this device.
  await expect(card(page)).toBeVisible();
  await expect(page.getByTestId("push-devices")).toHaveCount(0);
  await segment(page, "on").click();
  const device = page.getByTestId("push-device");
  await expect(device).toHaveCount(1);
  await expect(device).toHaveAttribute("data-this", "true");
  expect(
    await page.evaluate(() =>
      (window as never as { __ohSubscribed: () => boolean }).__ohSubscribed(),
    ),
  ).toBe(true);
  const a11y = await new AxeBuilder({ page })
    .include('[data-testid="experimental-push-when-your-turn"]')
    .exclude(".ex-pic")
    .analyze();
  expect(a11y.violations).toEqual([]);

  // A test reaches the push service and says so on the card.
  await device.getByTestId("push-device-test").click();
  await expect(page.getByTestId("push-note")).toHaveAttribute(
    "data-outcome",
    "delivered",
  );
  let messages = await sent(page);
  expect(messages).toHaveLength(1);
  expect(messages[0]?.payload?.kind).toBe("test");
  expect(messages[0]?.urgency).toBe("high");
  await card(page).scrollIntoViewIfNeeded();
  await snapshot(page, "card-fi");

  // A reply while the person is in front of the tab: no notification.
  await page.goto("/workspaces");
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi(?:%3A|:)/);
  const conversation = new URL(page.url()).searchParams.get("conversation");
  const rail = page.getByRole("navigation").getByTestId("rail-yours");
  await send(page, "ensimmäinen viesti");
  await expect(page.getByTestId("message-input")).toBeEnabled({
    timeout: 25000,
  });
  await page.waitForTimeout(3000);
  expect(await sent(page)).toHaveLength(1);

  // Away (the tab hidden and the host's 25-second presence window passed):
  // the next reply notifies, with the names and the kind but no message
  // text.
  await page.evaluate(() => {
    (window as never as { __ohHidden: boolean }).__ohHidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(26000);
  await send(page, "salainen toinen viesti");
  await expect
    .poll(async () => (await sent(page)).length, { timeout: 25000 })
    .toBe(2);
  messages = await sent(page);
  const turn = messages[1];
  expect(turn?.endpoint).toBe(sub.endpoint);
  expect(Number(turn?.ttl)).toBeGreaterThan(0);
  expect(turn?.topic).not.toBe("");
  expect(turn?.payload?.kind).toBe("turn");
  expect(turn?.payload?.tag).toBe(conversation);
  expect(String(turn?.payload?.url)).toContain(`conversation=${conversation}`);
  expect(JSON.stringify(turn?.payload)).not.toContain("salainen");
  expect(Object.keys(turn?.payload ?? {}).sort()).toEqual(
    expect.arrayContaining(["kind", "lang", "tag", "url", "v"]),
  );
  for (const key of Object.keys(turn?.payload ?? {}))
    expect(["v", "kind", "lang", "workspace", "title", "url", "tag"]).toContain(
      key,
    );

  // Another turn of the same conversation before the person came back:
  // still one notification.
  await send(page, "kolmas viesti");
  await expect(page.getByTestId("message-input")).toBeEnabled({
    timeout: 25000,
  });
  await page.waitForTimeout(2500);
  expect(await sent(page)).toHaveLength(2);

  // A tap routes this window to the conversation.
  await page.evaluate(() => {
    (window as never as { __ohHidden: boolean }).__ohHidden = false;
  });
  await page.goto("/settings/experimental");
  await expect(
    page.getByRole("button").and(page.getByTestId("account-menu-trigger")),
  ).toBeAttached();
  await page.evaluate(
    (url) => (window as never as { __ohTap: (u: string) => void }).__ohTap(url),
    String(turn?.payload?.url),
  );
  await expect(page).toHaveURL(
    new RegExp(
      `conversation=${String(conversation).replace(":", "(?:%3A|:)")}`,
    ),
  );
  await expect(rail).toBeAttached();

  // The same card in English, on another browser of the person's.
  const en = await browser.newContext({
    baseURL: hostOrigin,
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
    locale: "en-US",
  });
  const enPage = await en.newPage();
  await enPage.addInitScript(fakePush, sub);
  await signIn(enPage);
  await enPage.goto("/settings/experimental");
  await expect(enPage.getByTestId("push-device")).toHaveCount(1);
  await card(enPage).scrollIntoViewIfNeeded();
  await snapshot(enPage, "card-en");
  await en.close();

  // Removing the device unsubscribes it; turning the feature off forgets
  // the key on the daemon.
  await page.goto("/settings/experimental");
  await page
    .getByTestId("push-device")
    .getByTestId("push-device-remove")
    .click();
  await expect(page.getByTestId("push-no-devices")).toBeVisible();
  expect(
    await page.evaluate(() =>
      (window as never as { __ohSubscribed: () => boolean }).__ohSubscribed(),
    ),
  ).toBe(false);
  await segment(page, "off").click();
  await expect(segment(page, "off")).toHaveAttribute("aria-pressed", "true");
  const state = await (
    await page.request.get("/api/v1/notifications/push")
  ).json();
  expect(state.public_key).toBeNull();
});

test("@push-when-your-turn a push service that refuses the test says so on the card", async ({
  page,
}) => {
  const sub: Subscription = await (
    await page.request.get("/fixture/push-subscription?user=alice")
  ).json();
  await page.addInitScript(fakePush, sub);
  await signIn(page);
  await page.goto("/settings/experimental");
  await segment(page, "on").click();
  await expect(page.getByTestId("push-device")).toHaveCount(1);
  await page.request.get("/fixture/push-status?status=503");
  await page.getByTestId("push-device-test").click();
  await expect(page.getByTestId("push-note")).toHaveAttribute(
    "data-outcome",
    "rejected",
  );
  await expect(page.getByTestId("push-device-failed")).toBeVisible();
  // The service worker the gateway serves from the site origin.
  const worker = await page.request.get("/push-sw.js");
  expect(worker.status()).toBe(200);
  expect(worker.headers()["content-type"]).toContain("javascript");
});
