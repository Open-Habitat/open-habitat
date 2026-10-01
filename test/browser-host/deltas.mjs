// End-to-end fixture check against a running browser-host (not injected SSE).
// Run with BROWSER_HOST_ORIGIN=https://127.0.0.1:<port> node test/browser-host/deltas.mjs
import { chromium } from "../../web/node_modules/playwright/index.mjs";
import assert from "node:assert/strict";

const origin = process.env.BROWSER_HOST_ORIGIN;
if (!origin) throw new Error("BROWSER_HOST_ORIGIN required");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  const get = async (path) => {
    const r = await page.request.get(origin + path);
    assert.equal(r.status(), 200, `${path}: ${await r.text()}`);
    return r.json();
  };
  assert.equal((await page.request.get(origin + "/fixture/scenario?value=pi-deltas")).status(), 204);
  assert.equal((await page.request.get(origin + "/fixture/pi-state?value=usable")).status(), 204);
  await page.goto(origin + "/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice" }).click();
  const csrf = (await get("/auth/session")).csrf;
  const workspace = (await get("/api/v1/snapshot")).workspaces.find((w) => w.name === "ordinary-dir").workspace_id;
  const post = async (path, body) => {
    const r = await page.request.post(origin + path, {
      headers: { "X-Agent-Host-CSRF": csrf, Origin: origin },
      data: body,
    });
    assert.equal(r.status(), 200, `${path}: ${await r.text()}`);
    return r.json();
  };
  const agent = (await post("/api/v1/conversations", { workspace_id: workspace })).agent_id;
  const id = agent.slice(3);
  await post(`/api/v1/conversations/${id}/send`, {
    message: "fixture delta turn",
    command_id: "11111111-1111-4111-8111-111111111112",
  });
  const deadline = Date.now() + 15000;
  let snap, tail;
  do {
    snap = await get("/api/v1/snapshot");
    tail = snap.agents.find((a) => a.agent_id === agent)?.live_tail ?? [];
    if (tail.some((e) => e.kind === "assistant.delta") && tail.some((e) => e.kind === "tool.started")) break;
    await new Promise((resolve) => setTimeout(resolve, 70));
  } while (Date.now() < deadline);
  assert(tail.some((e) => e.kind === "assistant.delta"), "mid-turn text missing");
  const started = tail.find((e) => e.kind === "tool.started");
  assert(started?.payload.tool_call_id, "mid-turn correlated tool missing");
  // The snapshot cursor is the handoff: only subsequent events may be replayed.
  const frames = await page.evaluate(async (cursor) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const found = [];
    try {
      const response = await fetch(`/api/v1/events?after=${encodeURIComponent(cursor)}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`events: ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let end;
        while ((end = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const data = block.split("\n").find((line) => line.startsWith("data: "));
          if (data) found.push(JSON.parse(data.slice(6)));
        }
        if (found.some((e) => e.kind === "tool.finished") && found.some((e) => e.kind === "history.entry" && e.payload.entry_kind === "assistant")) break;
      }
    } finally {
      clearTimeout(timer);
      controller.abort();
    }
    return found;
  }, snap.event_cursor);
  const finished = frames.find((e) => e.kind === "tool.finished");
  assert.equal(finished?.payload.tool_call_id, started.payload.tool_call_id);
  assert(frames.some((e) => e.kind === "assistant.delta"), "delayed text not replayed");
  const native = frames.find((e) => e.kind === "history.entry" && e.payload.entry_kind === "assistant");
  assert(native?.native_key, "native assistant key missing");
  const history = await get(`/api/v1/agents/${agent}/history`);
  assert(history.entries.some((e) => e.entry_key === native.native_key), "SSE key differs from JSONL history");
  console.log("fake Pi mid-turn tail, correlated tools, delayed deltas and native history: passed");
} finally {
  await browser.close();
}
