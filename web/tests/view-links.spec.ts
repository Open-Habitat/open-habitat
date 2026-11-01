import { workerHostPort } from "../test-ports.mjs";
import { createHostTest, expect, type Page } from "./worker-host";

// Shared view addresses (ADR 0033, ADR 0035) against the real gateway and
// daemon handlers: the person shares a view on its card, and a browser
// context with no session at all opens it top-level on the address's own
// content host in the view namespace. Sharing again revives the same link;
// only deletion ends it for good. Same-UID synthetic evidence; it says
// nothing about separate Unix users or a real ingress.
const test = createHostTest(false, {
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
});

async function conversation(page: Page): Promise<string> {
  await page.request.get("/fixture/scenario?value=ready");
  await page.goto("/workspaces");
  await page.getByTestId("github-sign-in").click();
  await page.getByRole("link").and(page.locator('a[href*="code=42"]')).click();
  await page
    .getByRole("navigation")
    .getByTestId("workspace-ordinary-dir")
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

test("anyone with the link opens the view without a session while it is shared", async ({
  page,
  browser,
}, info) => {
  const id = await conversation(page);
  const first = await offer(page, id);
  const card = page.locator(
    `[data-testid="view-offer"][data-view-id="${first}"]`,
  );
  await card.getByTestId("view-share").click();
  const dialog = page.getByTestId("view-link-dialog");
  await expect(dialog).toContainText("Kuka tahansa, jolla on linkki");
  await dialog.getByTestId("segment-7").click();
  await dialog.getByTestId("view-link-create").click();
  const field = dialog.getByTestId("view-link-url");
  await expect(field).toHaveValue(
    /^https:\/\/oh-view-[a-z2-7]{52}\.oh\.localhost\/[A-Za-z0-9_-]{43}\/$/,
  );
  const link = await field.inputValue();
  await page.screenshot({ path: info.outputPath("dialog.png") });
  await dialog.getByTestId("view-link-close").click();
  await expect(card.getByTestId("view-shared")).toContainText(
    "Jaettu linkillä",
  );

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
  const response = await reader.goto(link);
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
  expect(new URL(reader.url()).pathname).toMatch(
    /^\/[A-Za-z0-9_-]{43}\/index\.html$/,
  );
  // A relative link stays under the token.
  await reader.locator("#bundle").click();
  await expect(body).toHaveAttribute("data-rendered", "yes");
  expect(await recipient.cookies()).toEqual([]);
  expect(sent.every((c) => c === "")).toBe(true);
  await reader.screenshot({ path: info.outputPath("recipient.png") });
  // The link is not a session: the app still asks the recipient to sign in.
  await reader.goto(`${app}/workspaces`);
  await expect(reader.getByTestId("github-sign-in")).toBeVisible();

  // Stopping sharing ends anonymous reads; sharing again revives the same
  // link. A newer export of the view is a view of its own, never moved in.
  await card.getByTestId("view-share").click();
  await dialog.getByTestId("view-link-revoke").click();
  await expect(dialog.getByTestId("view-link-revoked")).toBeVisible();
  await dialog.getByTestId("view-link-close").click();
  await expect(card.getByTestId("view-shared")).toHaveCount(0);
  expect((await reader.goto(link))?.status()).toBe(404);
  const second = await offer(page, id);
  const card2 = page.locator(
    `[data-testid="view-offer"][data-view-id="${second}"]`,
  );
  await expect(card2).toBeVisible();
  await expect(card2.getByTestId("view-shared")).toHaveCount(0);
  await card.getByTestId("view-share").click();
  await dialog.getByTestId("view-link-create").click();
  await expect(dialog.getByTestId("view-link-url")).toHaveValue(link);
  await dialog.getByTestId("view-link-close").click();
  await expect(card2.getByTestId("view-shared")).toHaveCount(0);
  await reader.goto(link);
  await expect(body).toHaveAttribute("data-script", "yes");

  // The person's own list in Settings has it too.
  await page.goto("/settings/account");
  await expect(page.getByTestId("view-link-row")).toHaveCount(1);

  // The administrator sees who shares what, never the address, and deletes
  // it for good.
  await page.goto("/settings/users");
  const admin = page.getByTestId("view-links-admin");
  await expect(admin.getByTestId("view-link-admin-row")).toHaveCount(1);
  expect(await admin.textContent()).not.toContain(new URL(link).host);
  await admin.getByTestId("view-link-admin-revoke").click();
  await expect(admin.getByTestId("view-link-admin-row")).toHaveCount(0);
  const gone = await reader.goto(link);
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
  await card.getByTestId("view-open-tab").click();
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
  reader.on("request", async (request) => {
    const headers = await request.allHeaders();
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

  // Published, the same address takes anyone to the content host.
  await card.getByTestId("view-share").click();
  const dialog = page.getByTestId("view-link-dialog");
  await dialog.getByTestId("view-link-create").click();
  await expect(dialog.getByTestId("view-link-url")).not.toHaveValue("");
  await dialog.getByTestId("view-link-close").click();
  await reader.goto(entry);
  await expect(reader).toHaveURL(
    /^https:\/\/oh-view-[a-z2-7]{52}\.oh\.localhost\/[A-Za-z0-9_-]{43}\/index\.html$/,
  );
  await expect(reader.locator("body")).toHaveAttribute("data-script", "yes");
  expect(new URL(reader.url()).pathname).not.toContain(secret);

  // Private again, the address is the sign-in page once more; signing in
  // as the owner returns to the address and frames the view.
  await card.getByTestId("view-share").click();
  await dialog.getByTestId("view-link-revoke").click();
  await expect(dialog.getByTestId("view-link-revoked")).toBeVisible();
  await dialog.getByTestId("view-link-close").click();
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
  await visitor.close();
});
