import { snapshot } from "../lab/session.mjs";
import { workerHostPort } from "../test-ports.mjs";
import { createHostTest, expect, type Locator, type Page } from "./worker-host";

// Shared view addresses (ADR 0033, ADR 0035) against the real gateway and
// daemon handlers: the person makes a view public with its card's switch,
// and a browser context with no session at all opens its stable address,
// which redirects to the address's own content host in the view namespace.
// Public again revives the same link; only deletion ends it for good. Same-UID synthetic evidence; it says
// nothing about separate Unix users or a real ingress.
const test = createHostTest(false, {
  BROWSER_HOST_LAB: process.env.OH_VISUAL_CAPTURE === "1" ? "1" : "0",
  BROWSER_HOST_VIEWS: "1",
  BROWSER_HOST_VIEW_LINKS: "1",
});
const port = workerHostPort(Number(process.env.TEST_PARALLEL_INDEX ?? 0));
const app = `https://app.oh.localhost:${port}`;
test.use({
  baseURL: app,
  launchOptions: {
    args: [`--host-resolver-rules=MAP *.oh.localhost:443 127.0.0.1:${port}`],
  },
  ignoreHTTPSErrors: true,
  viewport: { width: 1366, height: 800 },
  deviceScaleFactor: 2,
});

async function conversation(page: Page): Promise<string> {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId(
      process.env.OH_VISUAL_CAPTURE === "1"
        ? "workspace-aurinkokello"
        : "workspace-ordinary-dir",
    )
    .click();
  await page.getByTestId(/^(new-conversation|conversation-start)$/).click();
  await expect(page).toHaveURL(/conversation=pi:/);
  return new URL(page.url()).searchParams.get("conversation") ?? "";
}

async function offer(page: Page, target: string): Promise<string> {
  const res = await page.request.get(
    `/fixture/view?target=${encodeURIComponent(target)}`,
  );
  expect(res.status()).toBe(200);
  return (await res.json()).view_id;
}

async function copied(page: Page, card: Locator): Promise<string> {
  await card.hover();
  await card.getByTestId("view-copy-link").click();
  return page.evaluate(() => navigator.clipboard.readText());
}

test("anyone with the link opens the view without a session while it is public", async ({
  page,
  context,
  browser,
}, info) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const id = await conversation(page);
  const first = await offer(page, id);
  const card = page.locator(
    `[data-testid="view-offer"][data-view-id="${first}"]`,
  );
  // One press makes it public; only then is there a link to copy.
  await expect(card.getByTestId("view-copy-link")).toHaveCount(0);
  await card.hover();
  await card.getByTestId("view-public").click();
  await expect(card).toHaveAttribute("data-public", "true");
  const entry = await copied(page, card);
  expect(entry).toMatch(
    new RegExp(`^${app.replace(/[.]/g, "\\.")}/n/[A-Za-z0-9_-]{43}$`),
  );
  // The date opens the lengths; a choice applies at once.
  await card.hover();
  await card.getByTestId("view-public-until").click();
  await expect(
    page.getByRole("menuitemradio", { checked: true }),
  ).toHaveAttribute("data-testid", "view-duration-30");
  const mark = page
    .getByTestId("view-duration-30")
    .locator('[aria-hidden="true"]');
  await expect(mark).not.toHaveCSS("color", "rgba(0, 0, 0, 0)");
  await expect(mark).toHaveCSS("border-top-width", "0px");
  if (process.env.OH_VISUAL_CAPTURE === "1")
    await snapshot(
      page,
      "../issues/choice-menu-single-select/evidence/view-duration",
      { labOrigin: app },
    );
  await page.getByTestId("view-duration-7").click();
  await card.hover();
  await card.getByTestId("view-public-until").click();
  await expect(page.getByTestId("view-duration-7")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await page.keyboard.press("Escape");
  // Later, the saved expiry is no longer one of the presets counted from
  // today. Show that exact current date rather than an empty selection.
  const now = Date.now();
  await page.clock.setFixedTime(now + 2 * 24 * 60 * 60 * 1000);
  await card.hover();
  await card.getByTestId("view-public-until").click();
  await expect(
    page.getByRole("menuitemradio", { checked: true }),
  ).toHaveAttribute("data-testid", "view-duration-current");
  await page.getByTestId("view-duration-current").click();
  await page.clock.setFixedTime(now);
  await card.hover();
  await card.getByTestId("view-public-until").click();
  await expect(
    page.getByRole("menuitemradio", { checked: true }),
  ).toHaveAttribute("data-testid", "view-duration-7");
  await page.keyboard.press("Escape");
  await page.screenshot({ path: info.outputPath("public.png") });

  // A recipient: a fresh browser context, so no cookie of any kind.
  const recipient = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 800 },
  });
  const reader = await recipient.newPage();
  const sent: string[] = [];
  reader.on("request", async (request) => {
    sent.push((await request.allHeaders()).cookie ?? "");
  });
  await reader.goto(entry);
  await expect(reader).toHaveURL(
    /^https:\/\/oh-view-[a-z2-7]{52}\.oh\.localhost\/[A-Za-z0-9_-]{43}\/index\.html$/,
  );
  const content = reader.url();
  const response = await reader.goto(content);
  expect(response?.headers()["x-robots-tag"]).toBe(
    "noindex, nofollow, noarchive",
  );
  expect(response?.headers()["content-security-policy"]).toMatch(
    /^sandbox allow-scripts;/,
  );
  // The view runs like the owner's own: scripts, its stylesheet and image
  // under the token, and nothing of the app.
  const body = reader.locator("body");
  await expect(body).toHaveAttribute("data-script", "yes");
  await expect(body).toHaveAttribute("data-style", "rgb(1, 2, 3)");
  await expect(body).toHaveAttribute("data-image", "loaded");
  await expect(body).toHaveAttribute("data-cookie", "denied");
  await expect(body).toHaveAttribute("data-fetch", "denied");
  // A relative link stays under the token.
  await reader.locator("#bundle").click();
  await expect(body).toHaveAttribute("data-rendered", "yes");
  expect(await recipient.cookies()).toEqual([]);
  expect(sent.every((c) => c === "")).toBe(true);
  await reader.screenshot({ path: info.outputPath("recipient.png") });
  // The link is not a session: the app still asks the recipient to sign in.
  await reader.goto(`${app}/workspaces`);
  await expect(reader.getByTestId("github-sign-in")).toBeVisible();

  // Private again ends anonymous reads, also of the content address; public
  // again revives the same link. A newer export of the view is a view of its
  // own, never moved in.
  await card.hover();
  await card.getByTestId("view-public").click();
  await expect(card).toHaveAttribute("data-public", "false");
  await expect(card.getByTestId("view-copy-link")).toHaveCount(0);
  expect((await reader.goto(content))?.status()).toBe(404);
  const second = await offer(page, id);
  const card2 = page.locator(
    `[data-testid="view-offer"][data-view-id="${second}"]`,
  );
  await expect(card2).toHaveAttribute("data-public", "false");
  await card.hover();
  await card.getByTestId("view-public").click();
  await expect(card).toHaveAttribute("data-public", "true");
  expect(await copied(page, card)).toBe(entry);
  await expect(card2).toHaveAttribute("data-public", "false");
  await reader.goto(content);
  await expect(body).toHaveAttribute("data-script", "yes");

  // The person's own list in Settings has it too.
  await page.goto("/settings/account");
  await expect(page.getByTestId("view-address-row")).toHaveCount(1);
  await expect(page.getByTestId("view-address-row")).toHaveAttribute(
    "data-public",
    "true",
  );

  // The administrator sees who shares what, never the address, and deletes
  // it for good.
  await page.goto("/settings/users");
  const admin = page.getByTestId("view-links-admin");
  await expect(admin.getByTestId("view-link-admin-row")).toHaveCount(1);
  expect(await admin.textContent()).not.toContain(new URL(content).host);
  await admin.getByTestId("view-link-admin-revoke").click();
  await expect(admin.getByTestId("view-link-admin-row")).toHaveCount(0);
  const gone = await reader.goto(content);
  expect(gone?.status()).toBe(404);
  await expect(reader.locator("body")).toContainText("Linkki ei ole voimassa.");
  await recipient.close();
});

test("the stable address frames the view for its owner and redirects while public", async ({
  page,
  context,
  browser,
}, info) => {
  const id = await conversation(page);
  const viewId = await offer(page, id);
  const card = page.locator(
    `[data-testid="view-offer"][data-view-id="${viewId}"]`,
  );
  // The own tab reserves the address and opens at it.
  const opened = context.waitForEvent("page");
  await card.hover();
  await card.getByTestId("offer-open-tab").click();
  const tab = await opened;
  await expect(tab).toHaveURL(/\/n\/[A-Za-z0-9_-]{43}$/);
  const entry = tab.url();
  const secret = new URL(entry).pathname.slice(3);
  const framed = tab.frameLocator('[data-testid="view-frame"]').locator("body");
  await expect(framed).toHaveAttribute("data-script", "yes");
  await expect(framed).toHaveAttribute("data-style", "rgb(1, 2, 3)");
  await tab.close();

  // While private, a visitor without a session is asked to sign in and told
  // nothing about the view; nothing it loads carries the address onward.
  const visitor = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 800 },
  });
  const reader = await visitor.newPage();
  const leaks: string[] = [];
  reader.on("request", (request) => {
    // Referer is available in the request event. allHeaders can wait on
    // Chromium's extra-info event indefinitely for a redirected request.
    const headers = request.headers();
    if ((headers.referer ?? "").includes(secret)) leaks.push(request.url());
    if (request.url().includes(secret) && !request.isNavigationRequest())
      leaks.push(request.url());
  });
  const first = await reader.goto(entry);
  expect(first?.headers()["cache-control"]).toBe("no-store");
  expect(first?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(first?.headers()["x-robots-tag"]).toBe("noindex, nofollow, noarchive");
  await expect(reader.getByTestId("view-sign-in")).toBeVisible();
  await expect(reader.locator("body")).not.toContainText("Synteettinen");
  await reader.screenshot({ path: info.outputPath("private-visitor.png") });

  // Published, the same address takes anyone to the content host, and the
  // card's own tab opens it too.
  await card.hover();
  await card.getByTestId("view-public").click();
  await expect(card).toHaveAttribute("data-public", "true");
  const again = context.waitForEvent("page");
  await card.hover();
  await card.getByTestId("offer-open-tab").click();
  const publicTab = await again;
  await expect(publicTab).toHaveURL(/^https:\/\/oh-view-/);
  await publicTab.close();
  await reader.goto(entry);
  await expect(reader).toHaveURL(
    /^https:\/\/oh-view-[a-z2-7]{52}\.oh\.localhost\/[A-Za-z0-9_-]{43}\/index\.html$/,
  );
  await expect(reader.locator("body")).toHaveAttribute("data-script", "yes");
  expect(new URL(reader.url()).pathname).not.toContain(secret);

  // Private again, the address is the sign-in page once more; signing in
  // as the owner returns to the address and frames the view.
  await card.hover();
  await card.getByTestId("view-public").click();
  await expect(card).toHaveAttribute("data-public", "false");
  // Another person signing in learns only that it is not available.
  const other = await browser.newContext({ ignoreHTTPSErrors: true });
  const bob = await other.newPage();
  await bob.goto(entry);
  await bob.getByTestId("view-sign-in").click();
  await bob.getByRole("link").and(bob.locator('a[href*="code=43"]')).click();
  await expect(bob).toHaveURL(entry);
  await expect(bob.getByTestId("view-open-page")).toContainText(
    "Tämä näkymä ei ole saatavilla.",
  );
  await expect(bob.getByTestId("view-frame")).toHaveCount(0);
  await expect(bob.locator("body")).not.toContainText("Synteettinen");
  await other.close();
  await reader.goto(entry);
  await reader.getByTestId("view-sign-in").click();
  await reader
    .getByRole("link")
    .and(reader.locator('a[href*="code=42"]'))
    .click();
  await expect(reader).toHaveURL(entry);
  await expect(
    reader.frameLocator('[data-testid="view-frame"]').locator("body"),
  ).toHaveAttribute("data-script", "yes");
  expect(leaks).toEqual([]);

  // Deleted for good in Settings, the address never opens the view again,
  // even for its owner; the view's next own tab gets a new address.
  const settings = await context.newPage();
  await settings.goto("/settings/account");
  await settings.getByTestId("view-address-remove").click();
  await settings.getByTestId("view-address-remove-confirm").click();
  await expect(settings.getByTestId("view-address-row")).toHaveCount(0);
  await settings.close();
  await reader.goto(entry);
  await expect(reader.getByTestId("view-open-page")).toBeVisible();
  await expect(reader.getByTestId("view-frame")).toHaveCount(0);
  // The conversation's card learns of it when its tab is shown again.
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  const fresh = context.waitForEvent("page");
  await card.hover();
  await card.getByTestId("offer-open-tab").click();
  const next = await fresh;
  await expect(next).toHaveURL(/\/n\/[A-Za-z0-9_-]{43}$/);
  expect(next.url()).not.toBe(entry);
  expect(leaks).toEqual([]);
  await visitor.close();
});
