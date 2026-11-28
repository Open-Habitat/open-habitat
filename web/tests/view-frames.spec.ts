import { createServer } from "node:http";
import { type AddressInfo, connect, type Socket } from "node:net";
import AxeBuilder from "@axe-core/playwright";
import { workerHostPort } from "../test-ports.mjs";
import { createHostTest, expect, type Page } from "./worker-host";

// A view's frames (ADR 0032) against the real gateway and daemon: a view may
// frame its own pages by URL, in the panel, the own tab and at its public
// address, and nothing else. The view's document is sandboxed with an opaque
// origin, so its own page loads in a frame only because the gateway leaves
// frame-ancestors off a non-entry page fetched as a frame; that is the part
// each browser engine has to agree with. Same-UID synthetic evidence.
// `playwright.engines.config.ts` runs this spec in Firefox (and WebKit where
// its system libraries are installed).
const test = createHostTest(false, {
  BROWSER_HOST_VIEWS: "1",
  BROWSER_HOST_VIEW_LINKS: "1",
});
const port = workerHostPort(Number(process.env.TEST_PARALLEL_INDEX ?? 0));
const app = `https://app.oh.localhost:${port}`;
test.use({
  baseURL: app,
  ignoreHTTPSErrors: true,
  viewport: { width: 1366, height: 800 },
  locale: "fi-FI",
  // View hosts have the app's port only on its listener: the app names them
  // without one. Chromium maps the names to the listener; Firefox and WebKit
  // reach it through a CONNECT proxy that sends every name there.
  launchOptions: [
    async ({ browserName }, use) => {
      if (browserName === "chromium")
        return use({
          args: [
            `--host-resolver-rules=MAP *.oh.localhost:443 127.0.0.1:${port}`,
          ],
        });
      const proxy = createServer();
      proxy.on("connect", (_req, client: Socket, head: Buffer) => {
        const upstream = connect(port, "127.0.0.1", () => {
          client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
          upstream.write(head);
          upstream.pipe(client);
          client.pipe(upstream);
        });
        upstream.on("error", () => client.destroy());
        client.on("error", () => upstream.destroy());
      });
      await new Promise<void>((done) => proxy.listen(0, "127.0.0.1", done));
      const { port: proxyPort } = proxy.address() as AddressInfo;
      await use({
        proxy: { server: `http://127.0.0.1:${proxyPort}`, bypass: "" },
        firefoxUserPrefs: { "network.proxy.allow_hijacking_localhost": true },
      });
      proxy.close();
    },
    { scope: "worker" },
  ],
});

async function offered(page: Page): Promise<string> {
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
  const target = new URL(page.url()).searchParams.get("conversation") ?? "";
  const res = await page.request.get(
    `/fixture/view?target=${encodeURIComponent(target)}`,
  );
  expect(res.status()).toBe(200);
  return (await res.json()).view_id;
}

const viewFrame = (page: Page) => {
  const frame = page
    .frames()
    .find(
      (f) => f.parentFrame() === page.mainFrame() && /oh-view-/.test(f.url()),
    );
  if (!frame) throw new Error("missing view frame");
  return frame;
};

// The headers each view page was served with, by file name.
function policies(page: Page): Map<string, string> {
  const seen = new Map<string, string>();
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.hostname.startsWith("oh-view-") && url.pathname.endsWith(".html"))
      seen.set(
        url.pathname.split("/").pop() ?? "",
        response.headers()["content-security-policy"] ?? "",
      );
  });
  return seen;
}

function embed(src: string) {
  const frame = document.createElement("iframe");
  frame.src = src;
  document.body.append(frame);
}

test("a view frames its own page in the panel and the own tab, and nothing else", async ({
  page,
  context,
}) => {
  await offered(page);
  const csp = policies(page);
  // Anything a foreign site would serve is recorded, never shown.
  const foreign: string[] = [];
  await context.route("https://foreign.example/**", (route) => {
    foreign.push(route.request().url());
    return route.fulfill({ contentType: "text/html", body: "<p>foreign</p>" });
  });
  const card = page.getByTestId("view-offer");
  await card.getByTestId("offer-open").click();
  const body = page.frameLocator('[data-testid="view-frame"]').locator("body");
  await expect(body).toHaveAttribute("data-script", "yes");
  const viewOrigin = new URL(viewFrame(page).url()).origin;

  // A sibling page by URL: it loads inside the view at its own width and
  // the view stays up past the panel's 3 s answer window.
  await viewFrame(page).evaluate(() => {
    location.href = "nested.html";
  });
  await expect(body).toHaveAttribute("data-nested", "part:200");
  await page.waitForTimeout(3500);
  await expect(page.getByTestId("view-frame")).toBeVisible();
  // Only the framed page dropped frame-ancestors; the entry keeps the app.
  expect(csp.get("part.html")).not.toContain("frame-ancestors");
  expect(csp.get("part.html")).toContain(`frame-src ${viewOrigin};`);
  expect(csp.get("index.html")).toContain(`frame-ancestors ${app}`);

  // A refusal deeper down, in the framed page, still reaches the panel.
  const part = page.frames().find((f) => f.url().endsWith("/part.html"));
  await part?.evaluate(embed, "https://foreign.example/deep");
  const blocked = page.getByTestId("view-blocked");
  await expect(blocked).toHaveAttribute("data-reason", "embed");
  await expect(page.getByTestId("reopen-view")).toBeFocused();
  expect(
    (
      await new AxeBuilder({ page })
        .include('[data-testid="view-panel"]')
        .analyze()
    ).violations,
  ).toEqual([]);

  // Habitat's app, the editor's namespace, another view, an outside page and
  // data:/blob: documents stay refused, each with the embed notice.
  const otherView = `https://oh-view-${"a".repeat(52)}.oh.localhost:${port}/index.html`;
  for (const target of [
    `${app}/workspaces`,
    otherView,
    "https://foreign.example/phish",
    "data:text/html,<p>data</p>",
    "blob:",
  ]) {
    await page.getByTestId("reopen-view").click();
    await expect(body).toHaveAttribute("data-script", "yes");
    await viewFrame(page).evaluate((src) => {
      const url =
        src === "blob:"
          ? URL.createObjectURL(
              new Blob(["<p>blob</p>"], { type: "text/html" }),
            )
          : src;
      const frame = document.createElement("iframe");
      frame.src = url;
      document.body.append(frame);
    }, target);
    await expect(blocked, target).toHaveAttribute("data-reason", "embed");
  }
  expect(foreign).toEqual([]);

  // The own tab frames the view on the app's page; its own page works there.
  const opened = context.waitForEvent("page");
  await card.hover();
  await card.getByTestId("offer-open-tab").click();
  const tab = await opened;
  const tabBody = tab
    .frameLocator('[data-testid="view-frame"]')
    .locator("body");
  await expect(tabBody).toHaveAttribute("data-script", "yes");
  await viewFrame(tab).evaluate(() => {
    location.href = "nested.html";
  });
  await expect(tabBody).toHaveAttribute("data-nested", "part:200");
  await viewFrame(tab).evaluate(embed, "https://foreign.example/tab");
  await expect(tab.getByTestId("view-blocked")).toHaveAttribute(
    "data-reason",
    "embed",
  );
  expect(foreign).toEqual([]);
});

test("a published view frames its own page at its public address, and nothing else", async ({
  page,
}) => {
  const viewId = await offered(page);
  const card = page.locator(
    `[data-testid="view-offer"][data-view-id="${viewId}"]`,
  );
  await card.hover();
  await card.getByTestId("view-public").click();
  await expect(card).toHaveAttribute("data-public", "true");
  // While public, the own tab opens the content host as the top page, as a
  // recipient's browser does; that host takes no cookie of any kind.
  const opened = page.context().waitForEvent("page");
  await card.hover();
  await card.getByTestId("offer-open-tab").click();
  const reader = await opened;
  await expect(reader).toHaveURL(/^https:\/\/oh-view-.*\/index\.html$/);
  const content = reader.url().replace(/index\.html$/, "");
  const csp = policies(reader);
  const foreign: string[] = [];
  await reader.context().route("https://foreign.example/**", (route) => {
    foreign.push(route.request().url());
    return route.fulfill({ contentType: "text/html", body: "<p>foreign</p>" });
  });
  await reader.goto(`${content}nested.html`);
  const body = reader.locator("body");
  await expect(body).toHaveAttribute("data-nested", "part:200");
  expect(csp.get("part.html")).not.toContain("frame-ancestors");
  expect(csp.get("nested.html")).toContain("frame-ancestors");

  // There is no panel to explain a refusal here; the browser refuses.
  const refused = reader.evaluate(
    () =>
      new Promise<string>((done) =>
        addEventListener("securitypolicyviolation", (e) =>
          done(e.effectiveDirective),
        ),
      ),
  );
  await reader.evaluate(embed, "https://foreign.example/public");
  expect(await refused).toMatch(/^(frame-src|child-src)$/);
  await reader.goto(`${content}index.html`);
  const refusedApp = reader.evaluate(
    () =>
      new Promise<string>((done) =>
        addEventListener("securitypolicyviolation", (e) =>
          done(e.effectiveDirective),
        ),
      ),
  );
  await reader.evaluate(embed, `${app}/workspaces`);
  expect(await refusedApp).toMatch(/^(frame-src|child-src)$/);
  expect(foreign).toEqual([]);
});
