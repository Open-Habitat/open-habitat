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

  const open = card.getByTestId("view-open");
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
    (
      await new AxeBuilder({ page })
        .include('[data-testid="view-panel"]')
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath("panel.png") });

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

test("the own tab opens through the app's page with no opener, and account offers wait in the tray", async ({
  page,
  context,
}, info) => {
  await conversation(page);
  await offer(page, "account");
  const tray = page.getByTestId("view-tray");
  const card = tray.getByTestId("view-offer");
  await expect(card).toBeVisible();
  await page.screenshot({ path: info.outputPath("tray.png") });

  const opened = context.waitForEvent("page");
  await card.getByTestId("view-open-tab").click();
  const tab = await opened;
  await tab.waitForURL(/^https:\/\/oh-view-[a-z2-7]{52}\.oh\.localhost\//);
  await expect(tab.locator("body")).toHaveAttribute("data-script", "yes");
  expect(await tab.evaluate(() => window.opener)).toBeNull();
  expect(tab.url()).toMatch(/\/index\.html$/);
  await expect(card).toHaveAttribute("data-state", "tab_requested");
  await tab.close();

  await card.getByTestId("view-offer-dismiss").click();
  await expect(tray).toHaveCount(0);
});
