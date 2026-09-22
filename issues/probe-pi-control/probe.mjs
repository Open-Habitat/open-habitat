#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const piPackageRoot = "/home/maintainer/.local/lib/node_modules/@earendil-works/pi-coding-agent";
const piModule = `file://${piPackageRoot}/dist/index.js`;
const { SessionManager, createBashTool, createEditTool } = await import(piModule);
const activeRpcs = new Set();
let globalRequestSeq = 0;
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const live = process.argv.includes("--live");
const verifyOnly = process.argv.includes("--verify");
const outputArg = process.argv.indexOf("--output");
const output = outputArg >= 0 ? resolve(process.argv[outputArg + 1]) : join(here, "events.redacted.jsonl");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

class Rpc {
  constructor(label, cwd, args) {
    this.label = label;
    this.events = [];
    this.pending = new Map();
    this.waiters = [];
    this.stderr = "";
    this.proc = spawn("pi", args, { cwd, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, PI_SKIP_VERSION_CHECK: "1" } });
    this.exited = false;
    this.exitResult = new Promise(resolvePromise => this.proc.once("exit", (code, signal) => {
      this.exited = true;
      resolvePromise({ code, signal });
    }));
    activeRpcs.add(this);
    this.proc.stderr.setEncoding("utf8");
    this.proc.stderr.on("data", chunk => { this.stderr += chunk; });
    this.proc.stdout.setEncoding("utf8");
    let buffer = "";
    this.proc.stdout.on("data", chunk => {
      buffer += chunk;
      for (;;) {
        const i = buffer.indexOf("\n");
        if (i < 0) break;
        const line = buffer.slice(0, i).replace(/\r$/, "");
        buffer = buffer.slice(i + 1);
        if (!line) continue;
        const event = { ...JSON.parse(line), probeProcess: this.label };
        this.events.push(event);
        if (event.type === "response" && event.id && this.pending.has(event.id)) {
          this.pending.get(event.id)(event);
          this.pending.delete(event.id);
        }
        for (const waiter of [...this.waiters]) {
          if (waiter.predicate(event)) {
            waiter.resolve(event);
            this.waiters.splice(this.waiters.indexOf(waiter), 1);
          }
        }
      }
    });
  }
  send(command) {
    this.proc.stdin.write(`${JSON.stringify(command)}\n`);
  }
  request(command, timeoutMs = 15_000) {
    const id = `probe-request-${++globalRequestSeq}`;
    return new Promise((resolvePromise, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`RPC timeout for ${command.type}`)); }, timeoutMs);
      this.pending.set(id, response => { clearTimeout(timer); resolvePromise(response); });
      this.send({ ...command, id });
    });
  }
  waitFor(predicate, timeoutMs = 120_000) {
    const existing = this.events.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolvePromise, reject) => {
      const waiter = { predicate, resolve: event => { clearTimeout(timer); resolvePromise(event); } };
      const timer = setTimeout(() => {
        const i = this.waiters.indexOf(waiter);
        if (i >= 0) this.waiters.splice(i, 1);
        const recent = this.events.slice(-12).map(event => `${event.type}${event.command ? `:${event.command}` : ""}${event.toolName ? `:${event.toolName}` : ""}`).join(", ");
        reject(new Error(`RPC event timeout; recent events: ${recent}; stderr: ${this.stderr.slice(-1000)}`));
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }
  async waitForExit(timeoutMs) {
    let timer;
    const timedOut = new Promise(resolvePromise => { timer = setTimeout(() => resolvePromise(null), timeoutMs); });
    const result = await Promise.race([this.exitResult, timedOut]);
    clearTimeout(timer);
    return result;
  }
  async close() {
    this.proc.stdin.end();
    let result = await this.waitForExit(10_000);
    if (!result) {
      this.proc.kill("SIGTERM");
      result = await this.waitForExit(5_000);
    }
    if (!result) {
      this.proc.kill("SIGKILL");
      result = await this.waitForExit(5_000);
    }
    assert(result, "RPC did not exit after SIGKILL");
    activeRpcs.delete(this);
    assert(result.code === 0, `RPC exited ${result.code ?? result.signal}: ${this.stderr}`);
  }
  async terminate() {
    if (this.exited) {
      activeRpcs.delete(this);
      return;
    }
    this.proc.kill("SIGTERM");
    let result = await this.waitForExit(5_000);
    if (!result) {
      this.proc.kill("SIGKILL");
      result = await this.waitForExit(5_000);
    }
    assert(result, "RPC child survived SIGKILL");
    activeRpcs.delete(this);
  }
}

const ids = new Map();
let nextId = 0;
function scrub(value, root) {
  if (typeof value === "string") {
    let text = value.replaceAll(root, "<DISPOSABLE_ROOT>").replaceAll(process.env.HOME ?? "/home/user", "<HOME>");
    text = text.replace(UUID_PATTERN, match => {
      const key = match.toLowerCase();
      if (!ids.has(key)) ids.set(key, `<stable-id-${++nextId}>`);
      return ids.get(key);
    });
    if (/^(call_|[0-9a-f]{8}$)/i.test(text)) {
      if (!ids.has(text)) ids.set(text, `<stable-id-${++nextId}>`);
      text = ids.get(text);
    }
    return text;
  }
  if (Array.isArray(value)) return value.map(item => scrub(item, root));
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (["usage", "cost", "thinkingSignature", "textSignature", "responseId"].includes(key)) continue;
      out[key] = scrub(item, root);
    }
    return out;
  }
  return value;
}

async function deterministicProbe(root) {
  const packageJson = JSON.parse(await readFile(join(piPackageRoot, "package.json"), "utf8"));
  const cliVersion = execFileSync("pi", ["--version"], { encoding: "utf8" }).trim();
  const cliPath = await realpath(execFileSync("sh", ["-lc", "command -v pi"], { encoding: "utf8" }).trim());
  assert(cliVersion === packageJson.version, "Pi CLI and imported SDK package versions differ");

  const workspaceA = join(root, "workspace-a");
  const workspaceB = join(root, "workspace-b");
  const sessions = join(root, "sessions");
  await mkdir(workspaceA, { recursive: true });
  await mkdir(workspaceB, { recursive: true });

  const manager = SessionManager.create(workspaceA, sessions, { id: "11111111-1111-4111-8111-111111111111" });
  manager.appendMessage({ role: "user", content: "synthetic discovery prompt", timestamp: Date.now() });
  manager.appendMessage({
    role: "assistant", content: [{ type: "text", text: "synthetic discovery reply" }], api: "probe", provider: "probe",
    model: "probe", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    stopReason: "stop", timestamp: Date.now(),
  });
  const listedA = await SessionManager.list(workspaceA, sessions);
  const listedB = await SessionManager.list(workspaceB, sessions);
  const listedAll = await SessionManager.listAll(sessions);
  assert(listedA.length === 1, "workspace A must discover its session");
  assert(listedB.length === 0, "workspace B must not claim workspace A session");
  assert(listedAll.length === 1, "listAll must discover the disposable session");
  assert(listedA[0].cwd === workspaceA, "session cwd must preserve workspace association");

  const fixture = join(workspaceA, "fixture.txt");
  await writeFile(fixture, "before\n", "utf8");
  const editResult = await createEditTool(workspaceA).execute(
    "probe-edit-id", { path: fixture, edits: [{ oldText: "before", newText: "after" }] }, undefined, undefined,
  );
  assert(editResult.details?.patch?.includes("-before") && editResult.details.patch.includes("+after"), "edit tool must expose unified patch");

  const bashUpdates = [];
  const bashResult = await createBashTool(workspaceA).execute(
    "probe-bash-id", { command: "printf 'synthetic-start\\n'; sleep 0.2; printf 'synthetic-end\\n'" }, undefined,
    update => bashUpdates.push(update),
  );
  assert(bashResult.content[0].text.includes("synthetic-end"), "bash final output missing");
  assert(bashUpdates.some(update => update.content?.some(part => part.type === "text" && part.text.includes("synthetic-start"))), "bash tool did not emit content before its final result");

  return {
    workspaceA, workspaceB, sessions, sessionFile: manager.getSessionFile(), sessionId: manager.getSessionId(),
    evidence: [
      { type: "probe_evidence", capability: "version_alignment", cliVersion, sdkVersion: packageJson.version, cliPath },
      { type: "probe_evidence", capability: "history_discovery", listedForWorkspaceA: listedA.length, listedForWorkspaceB: listedB.length, listedAll: listedAll.length, cwd: listedA[0].cwd },
      { type: "probe_evidence", capability: "diff", details: editResult.details },
      { type: "probe_evidence", capability: "intermediate_output", updateCount: bashUpdates.length, firstUpdate: bashUpdates[0], contentUpdate: bashUpdates.find(update => update.content?.some(part => part.type === "text" && part.text.includes("synthetic-start"))), finalResult: bashResult },
    ],
  };
}

async function liveProbe(root, state) {
  const stage = name => console.error(`[probe] ${name}`);
  const extension = join(here, "probe-extension.ts");
  stage("start rpc");
  const args = ["--mode", "rpc", "--session-dir", state.sessions, "--model", "openai-codex/gpt-5.6-sol", "--thinking", "low", "--system-prompt", "Follow disposable probe instructions exactly. When asked to call a named probe tool, call it immediately.", "--no-builtin-tools", "--no-extensions", "-e", extension, "--no-skills", "--no-prompt-templates", "--no-context-files", "--approve"];
  const rpc = new Rpc("initial", state.workspaceA, args);
  const initial = await rpc.request({ type: "get_state" });
  stage("state ready");
  assert(initial.success && initial.data.sessionId, "get_state failed");
  await rpc.request({ type: "set_session_name", name: "Disposable Pi control probe" });

  const bashPromise = rpc.request({ type: "bash", command: "printf 'rpc-start\\n'; sleep 0.2; printf 'rpc-end\\n'" });
  await rpc.waitFor(event => event.type === "bash_execution_update" && event.delta?.includes("rpc-start"));
  const bashResponse = await bashPromise;
  assert(bashResponse.success && bashResponse.data.output.includes("rpc-end"), "RPC bash stream/final failed");
  stage("rpc bash complete");

  // Extension commands respond only after their handler completes, so service the
  // nested UI request before awaiting the outer prompt response.
  const questionPromise = rpc.request({ type: "prompt", message: "/probe-question" });
  const question = await rpc.waitFor(event => event.type === "extension_ui_request" && event.method === "input");
  rpc.send({ type: "extension_ui_response", id: question.id, value: "synthetic browser answer" });
  await rpc.waitFor(event => event.type === "extension_ui_request" && event.method === "notify");
  const questionResponse = await questionPromise;
  assert(questionResponse.success, "question command rejected");
  stage("question complete");

  const streamStartIndex = rpc.events.length;
  const streamAccepted = await rpc.request({ type: "prompt", message: "Call probe_stream exactly once, then answer only STREAM_DONE." });
  assert(streamAccepted.success, "stream prompt rejected");
  const streamStart = await rpc.waitFor(event => event.type === "tool_execution_start" && event.toolName === "probe_stream" && rpc.events.indexOf(event) >= streamStartIndex);
  stage("stream tool started");
  const steer = await rpc.request({ type: "steer", message: "After the tool, include STEER_SEEN in the terse response." });
  const follow = await rpc.request({ type: "follow_up", message: "Reply only FOLLOWUP_DONE." });
  assert(steer.success && follow.success, "queue commands rejected");
  await rpc.waitFor(event => event.type === "agent_settled" && rpc.events.indexOf(event) > rpc.events.indexOf(streamStart), 180_000);
  const streamEvents = rpc.events.slice(streamStartIndex);
  assert(streamEvents.some(event => event.type === "tool_execution_update" && event.toolCallId === streamStart.toolCallId), "missing tool intermediate update");
  assert(streamEvents.some(event => event.type === "tool_execution_end" && event.toolCallId === streamStart.toolCallId), "missing correlated tool end");
  assert(streamEvents.some(event => event.type === "queue_update" && (event.steering?.length || event.followUp?.length)), "missing queue update");
  stage("stream and queue settled");

  const abortIndex = rpc.events.length;
  const abortAccepted = await rpc.request({ type: "prompt", message: "Call probe_wait exactly once now. Do not call any other tool." });
  assert(abortAccepted.success, "abort prompt rejected");
  await rpc.waitFor(event => event.type === "tool_execution_start" && event.toolName === "probe_wait" && rpc.events.indexOf(event) >= abortIndex, 180_000);
  const abortResponse = await rpc.request({ type: "abort" }, 60_000);
  assert(abortResponse.success, "abort failed");
  await rpc.waitFor(event => event.type === "agent_settled" && rpc.events.indexOf(event) >= abortIndex, 60_000);
  stage("abort settled");

  const finalState = await rpc.request({ type: "get_state" });
  const sessionFile = finalState.data.sessionFile;
  const sessionId = finalState.data.sessionId;
  const firstEvents = [...rpc.events];
  await rpc.close();
  const persistedEntries = (await readFile(sessionFile, "utf8")).trim().split("\n").map(JSON.parse);
  const answerMarker = persistedEntries.find(entry => entry.type === "custom" && entry.customType === "probe-question-answer");
  assert(answerMarker?.data?.answer === "synthetic browser answer", "RPC extension UI answer was not persisted");
  stage("first rpc closed");

  const resumed = new Rpc("resumed", state.workspaceA, ["--mode", "rpc", "--session", sessionFile, "--model", "openai-codex/gpt-5.6-sol", "--thinking", "low", "--system-prompt", "Reply exactly as requested in this disposable probe.", "--no-builtin-tools", "--no-extensions", "-e", extension, "--no-skills", "--no-prompt-templates", "--no-context-files", "--approve"]);
  const resumedState = await resumed.request({ type: "get_state" });
  assert(resumedState.data.sessionId === sessionId && resumedState.data.messageCount > 0, "resume did not restore native identity/history");
  const resumedPrompt = await resumed.request({ type: "prompt", message: "Reply only RESUME_OK." });
  assert(resumedPrompt.success, "resumed prompt rejected");
  await resumed.waitFor(event => event.type === "agent_settled", 180_000);
  const resumedEvents = [...resumed.events];
  await resumed.close();
  stage("resume complete");

  const competingA = new Rpc("competing-a", state.workspaceA, ["--mode", "rpc", "--session", sessionFile, "--no-builtin-tools", "--no-extensions", "--no-skills", "--no-prompt-templates", "--no-context-files", "--approve"]);
  const competingB = new Rpc("competing-b", state.workspaceA, ["--mode", "rpc", "--session", sessionFile, "--no-builtin-tools", "--no-extensions", "--no-skills", "--no-prompt-templates", "--no-context-files", "--approve"]);
  const [aState, bState] = await Promise.all([competingA.request({ type: "get_state" }), competingB.request({ type: "get_state" })]);
  assert(aState.success && bState.success && aState.data.sessionId === bState.data.sessionId, "competing resume observation failed");
  await Promise.all([competingA.close(), competingB.close()]);
  stage("competing resume complete");

  return {
    events: [...firstEvents, ...resumedEvents],
    evidence: [
      { type: "probe_evidence", capability: "user_question_response", persistedAnswer: answerMarker.data.answer },
      { type: "probe_evidence", capability: "resume", sessionId, messageCount: resumedState.data.messageCount, resumedPromptAccepted: true },
      { type: "probe_evidence", capability: "competing_resume", firstAccepted: aState.success, secondAccepted: bState.success, sameNativeSessionId: aState.data.sessionId === bState.data.sessionId },
      { type: "probe_evidence", capability: "rpc_process_lifetime", observation: "closing stdin caused each RPC process to shut down cleanly; no detach/reattach command exists" },
    ],
  };
}

async function verify(path) {
  const lines = (await readFile(path, "utf8")).trim().split("\n").filter(Boolean).map(JSON.parse);
  const types = new Set(lines.map(line => line.type));
  for (const type of ["probe_evidence", "bash_execution_update", "extension_ui_request", "turn_start", "turn_end", "message_start", "message_update", "message_end", "tool_execution_start", "tool_execution_update", "tool_execution_end", "queue_update", "agent_settled"]) {
    assert(types.has(type), `redacted evidence missing ${type}`);
  }
  const starts = lines.filter(line => line.type === "tool_execution_start");
  const ends = lines.filter(line => line.type === "tool_execution_end");
  assert(starts.some(start => ends.some(end => end.toolCallId === start.toolCallId)), "tool IDs are not stable across start/end");
  const serialized = JSON.stringify(lines);
  assert(!serialized.includes(process.env.HOME ?? "/home/user"), "evidence contains an unredacted home path");
  assert(!new RegExp(UUID_PATTERN.source, "i").test(serialized), "evidence contains a raw UUID");
  assert(lines.some(line => line.type === "probe_evidence" && line.capability === "user_question_response" && line.persistedAnswer === "synthetic browser answer"), "evidence does not prove question response persistence");
  console.log(JSON.stringify({ ok: true, records: lines.length, path }));
}

if (verifyOnly) {
  await verify(output);
  process.exit(0);
}

const root = await mkdtemp(join(tmpdir(), "probe-pi-control-"));
try {
  const state = await deterministicProbe(root);
  const records = [...state.evidence];
  if (live) {
    const liveResult = await liveProbe(root, state);
    records.push(...liveResult.events, ...liveResult.evidence);
  }
  const selected = records.filter(record => [
    "probe_evidence", "response", "bash_execution_update", "extension_ui_request", "agent_start", "agent_end", "agent_settled",
    "turn_start", "turn_end", "message_start", "message_update", "message_end",
    "tool_execution_start", "tool_execution_update", "tool_execution_end", "queue_update",
  ].includes(record.type));
  await writeFile(output, `${selected.map(record => JSON.stringify(scrub(record, root))).join("\n")}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, live, output, records: selected.length }));
} finally {
  const cleanupErrors = [];
  for (const rpc of [...activeRpcs]) {
    try { await rpc.terminate(); } catch (error) { cleanupErrors.push(error); }
  }
  if (activeRpcs.size === 0) await rm(root, { recursive: true, force: true });
  if (cleanupErrors.length > 0) throw new AggregateError(cleanupErrors, `RPC cleanup failed; disposable root retained at ${root}`);
}
