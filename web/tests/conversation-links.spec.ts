import AxeBuilder from "@axe-core/playwright";
import type { Request } from "@playwright/test";
import { hostOrigin } from "../test-ports.mjs";
import { expect, type Page, test } from "./worker-host";

// Conversation links (conversation-links-prefilled-draft): a link
// `/new/<workspace>#n=<length>&draft=<message>` opens a new conversation in
// the workspace with the message in its field and nothing sent, once the
// person has allowed links in Settings › Vaaralliset toiminnot. The message
// rides in the fragment: it leaves the address bar at once and never reaches
// the host before the person sends it.
test.use({
  baseURL: hostOrigin,
  ignoreHTTPSErrors: true,
  viewport: { width: 1280, height: 900 },
  reducedMotion: "reduce",
});

const WS = "ordinary-dir";
const MESSAGE =
  "Yöajo epäonnistui vaiheessa `npm test` (loki logs/yoajo.txt & muut). Selvitä syy 🙂";
const link = (text: string, ws = WS, n = [...text].length) =>
  `/new/${encodeURIComponent(ws)}#n=${n}&draft=${encodeURIComponent(text)}`;

async function signIn(page: Page, path = "/workspaces") {
  await page.goto(path);
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
}

async function allowLinks(page: Page) {
  await page.goto("/settings/risky-features#conversation-links");
  await page.getByTestId("risky-conversation-links-allow").click();
  await page.getByTestId("risky-allow-confirm").click();
  await expect(
    page.getByTestId("risky-conversation-links-state"),
  ).toHaveAttribute("data-on", "");
}

/** Every request the page makes, so a test can say the message stayed in
 * the browser. */
function watchRequests(page: Page) {
  const seen: string[] = [];
  const record = (r: Request) => seen.push(`${r.url()}\n${r.postData() ?? ""}`);
  page.on("request", record);
  return {
    carries: (text: string) =>
      seen.some(
        (s) =>
          s.includes(text) ||
          s.includes(encodeURIComponent(text)) ||
          s.includes(JSON.stringify(text).slice(1, -1)),
      ),
    stop: () => page.off("request", record),
  };
}

const field = (page: Page) => page.getByTestId("message-input");
const mark = (page: Page) =>
  page.getByRole("group").and(page.getByTestId("link-mark"));
const held = (page: Page) => page.getByTestId("link-held");

async function expectNewConversation(page: Page) {
  await expect(page).toHaveURL(/\/workspaces\/ws_[^?]+\?conversation=pi:/);
  await expect(field(page)).toBeVisible();
}

test("@conversation-links allowed: the message waits in the new conversation's field, marked and unsent", async ({
  page,
}) => {
  await signIn(page);
  await allowLinks(page);
  await page.goto("/workspaces");
  const requests = watchRequests(page);
  await page.goto(link(MESSAGE));
  await expectNewConversation(page);
  await expect(field(page)).toHaveValue(MESSAGE);
  await expect(field(page)).toBeFocused();
  await expect(mark(page)).toBeVisible();
  await expect(
    page.locator(".ah-conversation-stream").getByText("Selvitä syy"),
  ).toHaveCount(0);
  expect(await page.evaluate(() => window.location.hash)).toBe("");
  // Nothing of the message went to the host; it is only in the field.
  expect(requests.carries("npm test")).toBe(false);
  const axe = await new AxeBuilder({ page })
    .include('[data-testid="link-mark"]')
    .analyze();
  expect(axe.violations).toEqual([]);

  // Back does not open the link again: its address was replaced.
  const conversation = page.url();
  await page.goBack();
  await expect(page).not.toHaveURL(/\/new\//);
  await expect(page).not.toHaveURL(/draft=/);
  await page.goForward();
  await expect(page).toHaveURL(conversation);

  // × takes the link's message out, and its mark with it.
  await page.getByTestId("link-remove").click();
  await expect(field(page)).toHaveValue("");
  await expect(mark(page)).toHaveCount(0);
  requests.stop();
});

test("@conversation-links sending is the person's own press, and the mark goes with it", async ({
  page,
}) => {
  await signIn(page);
  await allowLinks(page);
  await page.goto(link("muista tämä linkki"));
  await expectNewConversation(page);
  await expect(mark(page)).toBeVisible();
  await page
    .getByTestId("send")
    .and(page.locator('[data-mode="send"]'))
    .click();
  // The fake Pi answers the message it received.
  await expect(page.locator(".ah-conversation-stream")).toContainText(
    'Kysyit: "muista tämä linkki"',
    { timeout: 30000 },
  );
  await expect(mark(page)).toHaveCount(0);
  await expect(field(page)).toHaveValue("");
});

test("@conversation-links not allowed: an empty field and a notice; allowing in Settings brings the message on close", async ({
  page,
}) => {
  await signIn(page);
  const requests = watchRequests(page);
  await page.goto(link(MESSAGE));
  await expectNewConversation(page);
  await expect(held(page)).toBeVisible();
  await expect(field(page)).toHaveValue("");
  await expect(mark(page)).toHaveCount(0);
  await expect(page.getByText("npm test", { exact: false })).toHaveCount(0);
  expect(await page.evaluate(() => window.location.hash)).toBe("");
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).map((k) => sessionStorage.getItem(k)),
    ),
  ).not.toContainEqual(expect.stringContaining("npm test"));
  const conversation = page.url();

  // Closed without allowing: nothing changes.
  await page.getByTestId("link-open-setting").click();
  await expect(page).toHaveURL(
    /\/settings\/risky-features#conversation-links$/,
  );
  await expect(page.getByTestId("risky-conversation-links")).toBeFocused();
  await page.getByTestId("settings-close").click();
  await expect(page).toHaveURL(conversation);
  await expect(held(page)).toBeVisible();
  await expect(field(page)).toHaveValue("");

  // Allowed, then closed: the message is in the field with its mark.
  await page.getByTestId("link-open-setting").click();
  await page.getByTestId("risky-conversation-links-allow").click();
  await page.getByTestId("risky-allow-confirm").click();
  await expect(
    page.getByTestId("risky-conversation-links-state"),
  ).toHaveAttribute("data-on", "");
  // Not while Settings still lies over the conversation.
  await expect(field(page)).toHaveValue("");
  await page.getByTestId("settings-close").click();
  await expect(page).toHaveURL(conversation);
  await expect(field(page)).toHaveValue(MESSAGE);
  await expect(mark(page)).toBeVisible();
  await expect(held(page)).toHaveCount(0);
  // The setting's write carried only the switch.
  expect(requests.carries("npm test")).toBe(false);
  requests.stop();
});

test("@conversation-links the person's own draft is never overwritten: add after, replace or discard", async ({
  page,
}) => {
  await signIn(page);
  const own = "Oma keskeneräinen viestini";
  const open = async () => {
    await page.goto(link(MESSAGE));
    await expectNewConversation(page);
    await expect(held(page)).toBeVisible();
    await field(page).fill(own);
    await page.getByTestId("link-open-setting").click();
  };
  const card = page.getByRole("region").and(page.getByTestId("link-card"));

  await open();
  await page.getByTestId("risky-conversation-links-allow").click();
  await page.getByTestId("risky-allow-confirm").click();
  await page.getByTestId("settings-close").click();
  await expect(card).toBeVisible();
  await expect(field(page)).toHaveValue(own);
  await expect(page.getByTestId("link-card-text")).toContainText("Selvitä syy");
  const axe = await new AxeBuilder({ page })
    .include('[data-testid="link-card"]')
    .analyze();
  expect(axe.violations).toEqual([]);
  await page.getByTestId("link-append").click();
  await expect(field(page)).toHaveValue(`${own}\n\n${MESSAGE}`);
  await expect(card).toHaveCount(0);
  await expect(mark(page)).toHaveCount(0);
});

test("@conversation-links Replace and Discard on the card", async ({
  page,
}) => {
  await signIn(page);
  const own = "Oma keskeneräinen viestini";
  const card = page.getByRole("region").and(page.getByTestId("link-card"));
  for (const choice of ["replace", "dismiss"] as const) {
    await page.goto(link(MESSAGE));
    await expectNewConversation(page);
    await expect(held(page)).toBeVisible();
    await field(page).fill(own);
    await page.getByTestId("link-open-setting").click();
    const on = page.getByTestId("risky-conversation-links-allow");
    if (await on.isVisible()) {
      await on.click();
      await page.getByTestId("risky-allow-confirm").click();
    }
    await page.getByTestId("settings-close").click();
    await expect(card).toBeVisible();
    await page.getByTestId(`link-${choice}`).click();
    await expect(card).toHaveCount(0);
    if (choice === "replace") {
      await expect(field(page)).toHaveValue(MESSAGE);
      await expect(mark(page)).toBeVisible();
      // Turn links off again for the second round.
      await page.goto("/settings/risky-features");
      await page.getByTestId("risky-conversation-links-disable").click();
      await expect(
        page.getByTestId("risky-conversation-links-allow"),
      ).toBeVisible();
    } else {
      await expect(field(page)).toHaveValue(own);
      await expect(mark(page)).toHaveCount(0);
    }
  }
});

test("@conversation-links a workspace that is not found keeps the message to copy or start elsewhere", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await signIn(page);
  await allowLinks(page);
  await page.goto(link(MESSAGE, "asiakasportaali"));
  const missing = page.getByTestId("link-missing-workspace");
  await expect(missing).toBeVisible();
  await expect(page).toHaveURL(/\/new\/asiakasportaali$/);
  await expect(page.getByTestId("link-missing-text")).toContainText(
    "Selvitä syy",
  );
  await page.getByTestId("link-missing-copy").click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    MESSAGE,
  );
  const axe = await new AxeBuilder({ page })
    .include('[data-testid="link-missing-workspace"]')
    .analyze();
  expect(axe.violations).toEqual([]);
  await page
    .getByTestId("link-missing-workspace-start")
    .and(page.locator(`[data-workspace="${WS}"]`))
    .click();
  await expectNewConversation(page);
  await expect(field(page)).toHaveValue(MESSAGE);
  await expect(mark(page)).toBeVisible();
});

test("@conversation-links a hidden workspace starts anyway and offers to restore it", async ({
  page,
}) => {
  await signIn(page);
  await allowLinks(page);
  await page.goto("/workspaces");
  await page
    .locator(".ah-workspace")
    .getByRole("link")
    .and(page.getByTestId(`workspace-${WS}`))
    .click();
  const archived = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/v1/workspaces" &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button")
    .and(page.getByTestId("workspace-archive"))
    .click();
  expect((await archived).ok()).toBe(true);
  await page.goto(link(MESSAGE));
  await expectNewConversation(page);
  await expect(field(page)).toHaveValue(MESSAGE);
  const notice = page.getByTestId("link-hidden-workspace");
  await expect(notice).toBeVisible();
  await page.getByTestId("link-restore-workspace").click();
  await expect(notice).toHaveCount(0);
  await expect(
    page
      .locator(".ah-workspace")
      .getByRole("link")
      .and(page.getByTestId(`workspace-${WS}`)),
  ).toBeVisible();
});

test("@conversation-links a message too long or cut short is left out whole, and the conversation still opens", async ({
  page,
}) => {
  await signIn(page);
  await allowLinks(page);
  const dropped = page.getByTestId("link-dropped");
  // Cut by a chat app: n says more than arrived.
  await page.goto(link(MESSAGE.slice(0, 20), WS, [...MESSAGE].length));
  await expectNewConversation(page);
  await expect(dropped).toHaveAttribute("data-reason", "cut");
  await expect(field(page)).toHaveValue("");
  await expect(mark(page)).toHaveCount(0);

  await page.goto(link("x".repeat(4001)));
  await expectNewConversation(page);
  await expect(dropped).toHaveAttribute("data-reason", "long");
  await expect(field(page)).toHaveValue("");
});

test("@conversation-links not signed in: the link survives the sign-in in this browser and continues to the same place", async ({
  page,
  context,
}) => {
  await signIn(page);
  await allowLinks(page);
  await context.clearCookies();
  const requests = watchRequests(page);
  await page.goto(link(MESSAGE));
  await expect(page.getByTestId("link-sign-in")).toBeVisible();
  expect(await page.evaluate(() => window.location.hash)).toBe("");
  await page
    .getByRole("button")
    .and(page.getByTestId("github-sign-in"))
    .click();
  await page.getByRole("link").nth(0).click();
  await expectNewConversation(page);
  await expect(field(page)).toHaveValue(MESSAGE);
  await expect(mark(page)).toBeVisible();
  // The message did not pass through the sign-in or reach the host.
  expect(requests.carries("npm test")).toBe(false);
  expect(
    await page.evaluate(() => sessionStorage.getItem("nah:conversation-link")),
  ).toBeNull();
  requests.stop();
});

test("@conversation-links on a phone the mark, the notice and Avaa asetus fit the screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto(link(MESSAGE));
  await expectNewConversation(page);
  await expect(held(page)).toBeVisible();
  await expect(page.getByTestId("link-open-setting")).toBeInViewport();
  await page.getByTestId("link-open-setting").click();
  await page.getByTestId("risky-conversation-links-allow").click();
  await page.getByTestId("risky-allow-confirm").click();
  await page.getByTestId("settings-close").click();
  await expect(field(page)).toHaveValue(MESSAGE);
  await expect(mark(page)).toBeInViewport();
  const box = await mark(page).boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 390).toBe(true);
});
