import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { workerHostPort } from "../test-ports.mjs";
import { createHostTest, expect, type Page } from "./worker-host";

// Agent HTML views (ADR 0032) against the real gateway and daemon handlers:
// the app and the per-view hosts are same-site sibling names on this worker's
// TLS listener, and the fixture exports a synthetic site through the real
// plan, export and export-read route. Same-UID synthetic evidence; it says
// nothing about separate Unix users.
const test = createHostTest(false, { BROWSER_HOST_VIEWS: "1" });
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

test("a conversation offer opens sandboxed in the panel, isolated from the app session", async ({
  page,
  context,
}, info) => {
  const id = await conversation(page);
  const viewId = await offer(page, id);
  const card = page.getByTestId("view-offer");
  await expect(card).toHaveAttribute("data-view-id", viewId);

  // Record every request the browser sends to a view host.
  const viewRequests: { url: string; cookie: string }[] = [];
  page.on("request", async (request) => {
    if (new URL(request.url()).hostname.startsWith("oh-view-"))
      viewRequests.push({
        url: request.url(),
        cookie: (await request.allHeaders()).cookie ?? "",
      });
  });

  const open = card.getByTestId("offer-open");
  await open.click();
  const panel = page.getByTestId("view-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading")).toBeFocused();
  const frame = page.frameLocator('[data-testid="view-frame"]');
  const body = frame.locator("body");
  // Scripts run, the export's own stylesheet and script load through the
  // view cookie, and nothing of the app is reachable from the content.
  await expect(body).toHaveAttribute("data-script", "yes");
  await expect(body).toHaveAttribute("data-style", "rgb(1, 2, 3)");
  await expect(body).toHaveAttribute("data-cookie", "denied");
  await expect(body).toHaveAttribute("data-parent", "denied");
  await expect(body).toHaveAttribute("data-storage", "denied");
  await expect(body).toHaveAttribute("data-fetch", "denied");
  await expect(body).toHaveAttribute("data-image", "loaded");

  const cookies = await context.cookies();
  const viewCookie = cookies.find((c) => c.name === "__Host-oh-view");
  const appCookie = cookies.find((c) => c.name === "__Host-agent-host");
  expect(viewCookie?.domain).toMatch(/^oh-view-[a-z2-7]{52}\.oh\.localhost$/);
  expect(viewCookie?.httpOnly && viewCookie.secure).toBe(true);
  expect(appCookie?.domain).toBe("app.oh.localhost");
  expect(viewRequests.length).toBeGreaterThan(2);
  for (const request of viewRequests) {
    expect(request.cookie).not.toContain("__Host-agent-host");
    expect(request.cookie).not.toContain("__Host-oh-editor");
  }

  await expect(
    // The agent's own content is not Habitat's markup.
    (
      await new AxeBuilder({ page })
        .include('[data-testid="view-panel"]')
        .exclude('[data-testid="view-frame"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath("panel.png") });

  // A relative link goes to a sibling file inside the frame. That page is a
  // bundle that builds its code from a string at load, as production bundles
  // compiling schema validators do: without eval it would stay blank. Eval
  // adds no reach: workers stay off as before.
  await frame.locator("#bundle").click();
  await expect(body).toHaveAttribute("data-rendered", "yes");
  await expect(frame.locator("#bundle-heading")).toBeVisible();
  await expect(body).toHaveAttribute("data-wasm", "yes");
  await expect(body).toHaveAttribute("data-worker", "denied");

  // A direct open of the view's URL, and its errors, carry the sandbox too.
  const viewOrigin = new URL(viewRequests[0].url).origin;
  const direct = await context.newPage();
  for (const [path, status] of [
    ["/", 200],
    ["/missing.html", 404],
    ["/../../etc/passwd", 404],
  ] as const) {
    const response = await direct.goto(viewOrigin + path);
    expect(response?.status()).toBe(status);
    expect(response?.headers()["content-security-policy"]).toMatch(
      /^sandbox allow-scripts;/,
    );
  }
  await direct.close();

  await page.getByTestId("close-view").click();
  await expect(panel).toHaveCount(0);
  await expect(open).toBeFocused();
});

test("a view downloads as one zip and is listed with the conversation's files", async ({
  page,
}) => {
  const id = await conversation(page);
  const viewId = await offer(page, id);
  const card = page.getByTestId("view-offer");
  await expect(card).toHaveAttribute("data-view-id", viewId);

  // The zip holds the export's files, read through the app's own route.
  const res = await page.request.get(`/api/v1/views/${viewId}/zip`);
  expect(res.status(), await res.text()).toBe(200);
  await card.hover();
  const download = page.waitForEvent("download");
  await card.getByTestId("offer-download").click();
  const zip = await download;
  expect(zip.suggestedFilename()).toMatch(/\.zip$/);
  const bytes = readFileSync((await zip.path()) ?? "");
  expect(bytes.subarray(0, 4).toString("latin1")).toBe("PK\x03\x04");
  expect(bytes.includes(Buffer.from("index.html"))).toBe(true);
  expect(res.headers()["content-disposition"]).toBe("attachment");
  expect(res.headers()["content-security-policy"]).toMatch(/^sandbox;/);
  expect(
    (
      await page.request.get("/api/v1/views/vzzzzzzzzzzzzzzzzzzzzzzzzzz/zip")
    ).status(),
  ).toBe(404);

  // The conversation's chip lists the view; its row opens it beside and
  // closes it again.
  const chip = page.getByTestId("assets-chip");
  await expect(chip).toHaveAttribute("data-views", "1");
  await chip.click();
  const row = page
    .getByTestId("assets-list")
    .locator(`[data-testid="asset-entry"][data-id="${viewId}"]`);
  await row.getByTestId("asset-open").click();
  await expect(page.getByTestId("view-panel")).toBeVisible();
  await expect(card).toHaveAttribute("data-open", "true");
  await row.getByTestId("asset-open").click();
  await expect(page.getByTestId("view-panel")).toHaveCount(0);

  if (process.env.OH_VISUAL_CAPTURE) {
    // The view open beside its highlighted card, the card's corner icons
    // under the pointer, in both themes.
    const evidence = "../issues/offer-cards-and-assets-list/evidence";
    await page.setViewportSize({ width: 1440, height: 900 });
    await card.getByTestId("offer-open").click();
    await expect(page.getByTestId("view-frame")).toBeVisible();
    await card.hover();
    for (const theme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: theme });
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${evidence}/nakyma-1440-${theme}.png` });
    }
  }
});

test("a view cannot navigate its frame to a foreign origin", async ({
  page,
}) => {
  const id = await conversation(page);
  await offer(page, id);
  // Anything the foreign site would serve is recorded, never shown.
  const foreign: string[] = [];
  await page.route("https://foreign.example/**", (route) => {
    foreign.push(route.request().url());
    return route.fulfill({ contentType: "text/html", body: "<p>foreign</p>" });
  });
  await page.getByTestId("view-offer").getByTestId("offer-open").click();
  const body = page.frameLocator('[data-testid="view-frame"]').locator("body");
  await expect(body).toHaveAttribute("data-script", "yes");
  await expect(body).toHaveAttribute("data-style", "rgb(1, 2, 3)");

  // The view's own script steers its frame away; the app page's frame-src
  // admits only the view and editor namespaces, so the browser refuses.
  const view = page.frames().find((f) => f.url().includes("oh-view-"));
  expect(view).toBeDefined();
  const refused = page.waitForEvent("console", (m) =>
    /frame-src/.test(m.text()),
  );
  await view?.evaluate(() =>
    setTimeout(() => {
      location.href = "https://foreign.example/phish";
    }),
  );
  // Chrome names only the refused origin, not the path.
  expect((await refused).text()).toContain("https://foreign.example/");
  expect(foreign).toEqual([]);
  expect(page.frames().some((f) => f.url().includes("foreign.example"))).toBe(
    false,
  );
});

test("the own tab frames the view on the app's page, with no opener", async ({
  page,
  context,
}) => {
  const id = await conversation(page);
  await offer(page, id);
  const card = page.getByTestId("view-offer");
  await expect(card).toBeVisible();

  const opened = context.waitForEvent("page");
  await card.hover();
  await card.getByTestId("offer-open-tab").click();
  const tab = await opened;
  // The tab's top-level page stays the app's: a sandboxed view as the
  // top-level document loses its view cookie in browsers that block
  // third-party cookies, so its stylesheet and script would not load.
  // The launcher reserved the view's one address and replaced itself with
  // it: the tab is at the stable address even though sharing is off here.
  await expect(tab).toHaveURL(
    new RegExp(`^${app.replaceAll(".", "\\.")}/n/[A-Za-z0-9_-]{43}$`),
  );
  const frame = tab.getByTestId("view-frame");
  await expect(frame).toHaveAttribute("sandbox", "allow-scripts");
  const body = tab.frameLocator('[data-testid="view-frame"]').locator("body");
  await expect(body).toHaveAttribute("data-script", "yes");
  await expect(body).toHaveAttribute("data-style", "rgb(1, 2, 3)");
  await expect(body).toHaveAttribute("data-image", "loaded");
  await expect(body).toHaveAttribute("data-parent", "denied");
  expect(
    tab
      .frames()
      .some((f) =>
        /^https:\/\/oh-view-[a-z2-7]{52}\.oh\.localhost\/index\.html$/.test(
          f.url(),
        ),
      ),
  ).toBe(true);
  expect(await tab.evaluate(() => window.opener)).toBeNull();
  await expect(tab).toHaveTitle("Synteettinen näkymä");
  await expect(card).toHaveAttribute("data-state", "tab_requested");

  // A reload mints a fresh hand-off rather than replaying a spent one.
  await tab.reload();
  await expect(body).toHaveAttribute("data-style", "rgb(1, 2, 3)");
  await tab.close();
});
