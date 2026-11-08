// remote-browser-experimental: the server browser end to end in the
// synthetic lab with the REAL browser host (Xtigervnc and Google Chrome),
// started as `BROWSER_HOST_REAL_BROWSER=<Xvnc>:<chrome> scripts/lab.sh start`.
// The person is the lab's Alice in a headless Chromium; the agent is
// playwright-core on the host's cdp.sock. The lab has no agent listener, so
// the agent's request goes to the host's control socket, which is what the
// daemon's agent route does. Writes only into the issue's evidence folder.
//
//   node web/lab/remote-browser-e2e.mjs <dir with cdp.sock and control.sock>
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { chromium as agentChromium } from "playwright-core";
import { openLab, origin, snapshot } from "./session.mjs";

const dir = process.argv[2];
if (!dir) throw new Error("usage: remote-browser-e2e.mjs <browser dir>");
const out = fileURLToPath(
  new URL(
    "../../issues/remote-browser-experimental/evidence/",
    import.meta.url,
  ),
);
mkdirSync(out, { recursive: true });
const log = (...a) => console.log("e2e:", ...a);

const control = (method, path, body) =>
  new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath: `${dir}/control.sock`,
        path,
        method,
        headers: body ? { "Content-Type": "application/json" } : {},
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve({ status: res.statusCode, body: d }));
      },
    );
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });

const { browser, page } = await openLab({
  width: 1440,
  height: 900,
  deviceScaleFactor: 2,
});
const session = await (await page.request.get(`${origin}/auth/session`)).json();
const prefs = await page.request.put(`${origin}/api/v1/account/preferences`, {
  headers: {
    Origin: new URL(page.url()).origin,
    "X-Agent-Host-CSRF": session.csrf,
  },
  data: { experimental: { "remote-browser": true } },
});
if (!prefs.ok()) throw new Error("preferences");
await page.reload();

// 1. The person opens the browser from the rail: the real host starts.
const t0 = Date.now();
await page.getByTestId("browser-rail-row").click();
const sheet = page.getByTestId("browser-sheet");
await sheet.waitFor();
const viewer = page.getByTestId("browser-viewer");
await page.waitForFunction(
  () =>
    document
      .querySelector('[data-testid="browser-viewer"]')
      ?.getAttribute("data-phase") === "connected",
  null,
  { timeout: 60000 },
);
log("started and viewer connected in", Date.now() - t0, "ms");
await page.waitForTimeout(1500);
await snapshot(page, `${out}e2e-1-sheet-view`);

// 2. The agent connects to the same browser over cdp.sock and works in a
// sign-in page that asks for a confirmation code (local HTML: Birch's
// egress is limited, and no real service is used in evidence).
const endpoint = `ws+unix://${dir}/cdp.sock:/devtools/browser`;
const agent = await agentChromium.connectOverCDP(endpoint);
const context = agent.contexts()[0];
const work = await context.newPage();
await work.setContent(`<!doctype html><title>Vahvista uudelleen</title>
<body style="font:16px system-ui;background:#f3f5f8;display:grid;place-items:center;height:100vh;margin:0">
<form style="background:#fff;padding:28px;border-radius:10px;border:1px solid #dde1e7;display:grid;gap:12px;width:320px">
<b style="color:#0b5c8c">Esimerkkipalvelu</b><h2 style="margin:0">Vahvista uudelleen</h2>
<label>Tunnistussovelluksen koodi<input id="code" autocomplete="off" style="display:block;width:100%;padding:8px;font:16px system-ui"></label>
<button type="button" id="ok" style="padding:10px;background:#0b5c8c;color:#fff;border:0;border-radius:6px">Vahvista</button>
</form></body>`);
await work.mouse.move(700, 300);
await work.mouse.click(720, 420);
const second = await context.newPage();
await second.setContent(
  `<!doctype html><title>Kustannuspaikat</title><body style="font:15px system-ui;padding:24px"><h1>Kustannuspaikat · lokakuu 2026</h1><table border=1 cellpadding=6><tr><td>Hallinto</td><td>812,40</td></tr><tr><td>Myynti</td><td>201,15</td></tr></table></body>`,
);
await work.bringToFront();
await work.mouse.move(640, 380);
const status = JSON.parse((await control("GET", "/status")).body);
log(
  "host status",
  JSON.stringify({
    control: status.control,
    agent: status.agent,
    windows: status.windows.map((w) => w.title),
    pointer: !!status.pointer,
  }),
);
const loginWindow = status.windows.find(
  (w) => w.title === "Vahvista uudelleen",
);
const req = await control("POST", "/request", {
  window: loginWindow.id,
  text: "Esimerkkipalvelu pyytää vahvistuskoodia",
});
log("request", req.status);

// 3. The person sees the request in a conversation: the strip opens with
// the real pictures and the agent's pointer.
await page.getByTestId("browser-sheet-close").click();
await page.getByTestId("home-link").click();
await page.getByTestId("workspace-start-aurinkokello").last().click();
const strip = page.getByTestId("browser-strip");
await strip.waitFor({ timeout: 20000 });
await page.waitForFunction(
  () =>
    document.querySelectorAll('[data-testid="browser-window"] img').length >= 1,
  null,
  { timeout: 15000 },
);
await page.waitForTimeout(800);
await snapshot(page, `${out}e2e-2-strip-request`);

// 4. Where the code field is on the display, asked before control changes
// hands (Chrome's page sits below its toolbar in the 1280×800 display).
const field = await work.evaluate(() => {
  const r = document.getElementById("code").getBoundingClientRect();
  return {
    x: screenX + r.x + r.width / 2,
    y: screenY + (outerHeight - innerHeight) + r.y + r.height / 2,
  };
});
await page.getByTestId("browser-take-request").click();
await page.waitForFunction(
  () =>
    document
      .querySelector('[data-testid="browser-sheet"]')
      ?.getAttribute("data-mode") === "control",
);
await page.waitForFunction(
  () =>
    document
      .querySelector('[data-testid="browser-viewer"]')
      ?.getAttribute("data-phase") === "connected",
  null,
  { timeout: 20000 },
);
// While the person has control the agent's commands wait in the host.
let held = false;
const waiting = work
  .evaluate(() => document.getElementById("code").value)
  .then((v) => {
    held = true;
    return v;
  });
await page.waitForTimeout(1000);
const canvas = viewer.locator("canvas");
const box = await canvas.boundingBox();
// The person types the code into the real Chrome through noVNC.
await canvas.click({
  position: {
    x: (field.x / 1280) * box.width,
    y: (field.y / 800) * box.height,
  },
});
await page.keyboard.type("123456");
await page.waitForTimeout(800);
await snapshot(page, `${out}e2e-3-sheet-control`);
await page.waitForTimeout(1500);
log("agent command answered while the person had control:", held);
await sheet.getByTestId("browser-give-back").click();
const typed = await waiting;
log("after control returned the agent read the field:", JSON.stringify(typed));
await page.getByTestId("browser-sheet-close").click();
await page.waitForTimeout(1500);
await snapshot(page, `${out}e2e-4-after-give-back`);
await agent.close();

// 5. Closing the browser stops the host and every process it started.
await page.getByTestId("browser-rail-row").click();
await sheet.waitFor();
await page.getByTestId("browser-stop").click();
await page.waitForFunction(
  () =>
    document
      .querySelector('[data-testid="browser-rail-row"]')
      ?.getAttribute("data-state") === "stopped",
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
let left = "";
try {
  left = execFileSync("pgrep", ["-f", dir.replace(/\/[^/]+$/, "")], {
    encoding: "utf8",
  });
} catch {
  left = "";
}
left = left
  .split("\n")
  .filter((p) => p && +p !== process.pid && +p !== process.ppid)
  .join(" ");
log(
  "processes left after stop:",
  left
    ? execFileSync("ps", ["-o", "args=", "-p", left.replace(/ /g, ",")], {
        encoding: "utf8",
      }).slice(0, 300)
    : "none",
);
await browser.close();
process.exit(0);
