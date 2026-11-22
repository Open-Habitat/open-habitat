import { createServer } from "node:http";
import { snapshot } from "../lab/session.mjs";
import { hostOrigin } from "../test-ports.mjs";
import { createHostTest, expect } from "./worker-host";

const test = createHostTest(false, { BROWSER_HOST_LAB: "1" });
test.use({ baseURL: hostOrigin, ignoreHTTPSErrors: true });
test("feature popups can be switched, closed and close themselves", async ({
  page,
}) => {
  test.skip(!process.env.BROWSER_HOST_REAL_BROWSER, "requires Xvnc and Chrome");
  test.setTimeout(120000);
  const events: string[] = [];
  const site = createServer((req, res) => {
    if (req.url?.startsWith("/event/")) {
      events.push(req.url.slice(7));
      res.end();
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (req.url === "/popup") {
      res.end(`<!doctype html><title>Popup fixture</title><h1>Popup</h1><script>
        document.onkeydown = e => { if(e.key==='c') { opener.postMessage('complete',location.origin); window.close(); } if(e.key==='v') fetch('/event/popup'); };
      </script>`);
    } else {
      res.end(`<!doctype html><title>Main fixture</title><h1>Main</h1><script>
        document.onkeydown = e => { if(e.key==='p') window.open('/popup','flow','popup,width=400,height=300,left=100,top=100'); if(e.key==='b') window.open('about:blank#popup','blank-flow','popup,width=400,height=300,left=100,top=100'); if(e.key==='m') fetch('/event/main'); };
        window.onmessage = e => { if(e.origin===location.origin && e.data==='complete') fetch('/event/complete'); };
        window.onload = () => fetch('/event/ready');
      </script>`);
    }
  });
  await new Promise<void>((r) => site.listen(0, "127.0.0.1", r));
  try {
    const addr = site.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    await page.request.get("/fixture/scenario?value=ready");
    await page.goto("/workspaces");
    await page.getByTestId("github-sign-in").click();
    await page
      .getByRole("link")
      .and(page.locator('a[href*="code=42"]'))
      .click();
    const session = await (await page.request.get("/auth/session")).json();
    expect(
      (
        await page.request.put("/api/v1/account/preferences", {
          headers: {
            Origin: new URL(page.url()).origin,
            "X-Agent-Host-CSRF": session.csrf,
          },
          data: { experimental: { "remote-browser": true } },
        })
      ).ok(),
    ).toBe(true);
    await page.reload();
    await page.getByTestId("browser-rail-row").click();
    const viewer = page.getByTestId("browser-viewer");
    await expect(viewer).toHaveAttribute("data-phase", "connected", {
      timeout: 60000,
    });
    const canvas = viewer.locator("canvas");
    await canvas.click();
    await expect(page.getByTestId("browser-sheet")).toHaveAttribute(
      "data-mode",
      "control",
    );
    await page.keyboard.press("Control+l");
    await page.keyboard.type(`http://127.0.0.1:${addr.port}/`);
    await page.keyboard.press("Enter");
    await expect.poll(() => events.includes("ready")).toBe(true);
    async function select(chip: ReturnType<typeof page.locator>) {
      await chip.getByTestId("browser-window-select").click();
      await expect(chip.getByTestId("browser-window-select")).toBeEnabled();
    }
    const list = page.getByTestId("browser-window-list");
    const main = list.locator(".sb-window-chip").filter({
      has: page
        .getByTestId("browser-window-select")
        .filter({ hasText: "Main fixture" }),
    });
    const popup = list.locator(".sb-window-chip").filter({
      has: page
        .getByTestId("browser-window-select")
        .filter({ hasText: "Popup fixture" }),
    });
    await expect(main).toBeVisible();
    await page.keyboard.press("p");
    await expect(popup).toBeVisible();
    await select(main);
    await page.keyboard.press("m");
    // Real X input must reach the main page, not the still-open popup.
    await expect.poll(() => events.filter((e) => e === "main").length).toBe(1);
    await select(popup);
    await page.keyboard.press("v");
    await expect.poll(() => events.includes("popup")).toBe(true);
    if (process.env.OH_POPUP_CAPTURE) {
      await snapshot(page, `${process.env.OH_POPUP_CAPTURE}/popup`, {
        labOrigin: new URL(page.url()).origin,
      });
    }
    await popup.getByTestId("browser-window-close").click();
    await expect(popup).toHaveCount(0);
    await page.keyboard.press("m");
    await expect.poll(() => events.filter((e) => e === "main").length).toBe(2);
    await page.keyboard.press("p");
    await expect(popup).toBeVisible();
    await select(popup);
    await page.keyboard.press("c");
    await expect.poll(() => events.includes("complete")).toBe(true);
    await expect(popup).toHaveCount(0);
    await page.keyboard.press("m");
    await expect.poll(() => events.filter((e) => e === "main").length).toBe(3);
    // A blank feature popup must not replace or hide its opener in status.
    const mainID = await main.getAttribute("data-window");
    await page.keyboard.press("b");
    const blank = list.locator(".sb-window-chip").filter({
      has: page
        .getByTestId("browser-window-select")
        .filter({ hasText: "about:blank#popup" }),
    });
    await expect(blank).toBeVisible();
    const blankID = await blank.getAttribute("data-window");
    if (!mainID || !blankID) throw new Error("missing window identity");
    await expect
      .poll(async () => {
        const status = await (await page.request.get("/api/v1/browser")).json();
        return status.windows.map((w: { id: string }) => w.id).sort();
      })
      .toEqual([mainID, blankID].sort());
    await blank.getByTestId("browser-window-close").click();
    await expect(blank).toHaveCount(0);
    await expect(main).toHaveAttribute("data-window", mainID);
    await page.keyboard.press("m");
    await expect.poll(() => events.filter((e) => e === "main").length).toBe(4);
    // Reproduce the reported singleton inventory without assuming how the
    // opener disappeared: close it explicitly, leaving only its blank popup.
    await page.keyboard.press("b");
    await expect(blank).toBeVisible();
    await main.getByTestId("browser-window-close").click();
    await expect(main).toHaveCount(0);
    await expect(list.locator(".sb-window-chip")).toHaveCount(1);
    const solePopupID = await blank.getAttribute("data-window");
    await blank.getByTestId("browser-window-close").click();
    await expect(blank).toHaveCount(0);
    await expect(list.locator(".sb-window-chip")).toHaveCount(1);
    await expect
      .poll(async () => {
        const status = await (await page.request.get("/api/v1/browser")).json();
        return (
          status.windows.length === 1 &&
          status.windows[0].id !== solePopupID &&
          status.windows[0].title === "about:blank"
        );
      })
      .toBe(true);
    // No selection click: the replacement must already receive X input.
    await page.keyboard.press("Control+l");
    await page.keyboard.type(`http://127.0.0.1:${addr.port}/`);
    await page.keyboard.press("Enter");
    await expect.poll(() => events.filter((e) => e === "ready").length).toBe(2);
    await expect(main).toBeVisible();
    await page.getByTestId("browser-stop").click();
  } finally {
    await new Promise<void>((resolve, reject) =>
      site.close((e) => (e ? reject(e) : resolve())),
    );
  }
});
