// Engine check for implement-workspace-editor: sign in on the app host, mint
// an editor hand-off, frame the editor origin, answer its token request, wait
// for the workbench, open a file link through the daemon and press
// Ctrl+Alt+K inside the editor. Needs the synthetic host in editor mode with a
// real code-server (BROWSER_HOST_EDITOR=1, BROWSER_HOST_CODE_SERVER=...,
// optionally BROWSER_HOST_EDITOR_DOMAIN=example.com with the names mapped to
// 127.0.0.1, which WebKit needs: it does not treat *.localhost siblings as
// one site). Usage: node probe-editor-engines.mjs <chromium|firefox|webkit> <port>
// with DOMAIN set to the same domain. Prints what happened; writes nothing.
const { chromium, firefox, webkit } = await import(
  process.env.PW_MODULE ??
    "/home/maintainer/Sources/open-habitat__worktrees/wt-nh38adtpf2-implement-workspace-editor/web/node_modules/playwright/index.mjs"
);
const which = process.argv[2] || "chromium";
const port = process.argv[3] || "14894";
const app = `https://app.${process.env.DOMAIN ?? "oh.localhost"}:${port}`;
const B = { chromium, firefox, webkit }[which];
const b = await B.launch();
const ctx = await b.newContext({ ignoreHTTPSErrors: true });
const p = await ctx.newPage();
p.on("console", (m) => {
  if (m.type() === "error") console.log("console:", m.text().slice(0, 160));
});
await p.goto(app + "/");
await p.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
await p.getByRole("link", { name: "Alice" }).click();
const ws = await p.evaluate(async () =>
  (await (await fetch("/api/v1/snapshot")).json()).workspaces.map((w) => [
    w.workspace_id,
    w.name,
    w.kind,
  ]),
);
console.log("workspaces", ws.slice(0, 4));
const wid = ws[0][0];
const result = await p.evaluate(
  async ({ wid }) => {
    const s = await (await fetch("/auth/session")).json();
    const mint = async () =>
      await (
        await fetch("/auth/editor", {
          method: "POST",
          headers: { "X-Agent-Host-CSRF": s.csrf },
        })
      ).json();
    const origin = (await mint()).origin;
    const log = [];
    const f = document.createElement("iframe");
    f.style =
      "position:fixed;inset:0;width:100vw;height:100vh;z-index:9999;background:white";
    f.allow = "clipboard-read; clipboard-write";
    window.addEventListener("message", async (e) => {
      if (e.origin !== origin) return;
      log.push(e.data.type);
      if (e.data.type === "need-token") {
        const t = await mint();
        f.contentWindow.postMessage(
          { source: "open-habitat", type: "token", token: t.token },
          origin,
        );
      }
    });
    f.src = origin + "/_open-habitat/frame?workspace_id=" + wid;
    document.body.append(f);
    window.__ohlog = log;
    return origin;
  },
  { wid },
);
console.log("editor origin", result);
const t0 = Date.now();
for (let i = 0; i < 120; i++) {
  const l = await p.evaluate(() => window.__ohlog);
  if (l.includes("ready") || l.includes("failed")) break;
  await p.waitForTimeout(250);
}
console.log(
  "log",
  await p.evaluate(() => window.__ohlog),
  Date.now() - t0,
  "ms",
);
const inner = p.frameLocator("iframe").frameLocator("#editor");
try {
  await inner
    .locator(".monaco-workbench, .fake-workbench")
    .first()
    .waitFor({ timeout: 40000 });
  console.log("workbench visible", Date.now() - t0, "ms");
} catch (e) {
  console.log("no workbench", e.message.slice(0, 200));
}
await p.waitForTimeout(3000);
// open a file via the app API
const open = await p.evaluate(
  async ({ wid }) => {
    const s = await (await fetch("/auth/session")).json();
    const r = await fetch("/api/v1/editor/open", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Host-CSRF": s.csrf,
      },
      body: JSON.stringify({
        workspace_id: wid,
        path: process_path(),
        line: 2,
      }),
    });
    function process_path() {
      return "cmd/main.go";
    }
    return [r.status, await r.text()];
  },
  { wid },
);
console.log("open", open);
await p.waitForTimeout(1500);
console.log(
  "tabs",
  await inner
    .locator(".tabs-container .tab")
    .allTextContents()
    .catch(() => []),
);
// Ctrl+Alt+K inside the editor
await p.evaluate(() => {
  window.__ohlog.length = 0;
});
await inner
  .locator(".monaco-workbench, .fake-workbench")
  .first()
  .click({ position: { x: 600, y: 300 } });
await p.keyboard.press("Control+Alt+KeyK");
await p.waitForTimeout(500);
console.log("after key", await p.evaluate(() => window.__ohlog));
await b.close();
