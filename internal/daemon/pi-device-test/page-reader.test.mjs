import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import dgram from 'node:dgram';
import net from 'node:net';
import { networkInterfaces } from 'node:os';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm, mkdir, copyFile, symlink, readFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { readPage, headlessShell, launchArgs, egress, socketOwner, localAddress } from '../../../runtime/core/page-reader.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const cli = resolve(here, 'node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js');
const extension = resolve(here, '../../../runtime/core/page-reader.mjs');

// The pinned Playwright's headless shell, or another one Playwright installed
// here (the browser suite's). The shipped extension refuses to run Chromium
// without its sandbox; these synthetic pages are served by the test itself,
// so the direct reads below launch it without one where the host lacks the
// installation's AppArmor profile.
const browsers = process.env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), '.cache/ms-playwright');
let shell;
try { shell = headlessShell(browsers); } catch {
  throw new Error(`no Chromium headless shell under ${browsers}; scripts/ci-local.sh installs it before device tests; for a direct run, use the same PLAYWRIGHT_BROWSERS_PATH with \`npm exec --prefix web playwright install chromium chromium-headless-shell\``);
}

const sources = {
  readability: await readFile(resolve(here, 'node_modules/@mozilla/readability/Readability.js'), 'utf8'),
  turndown: await readFile(resolve(here, 'node_modules/turndown/lib/turndown.browser.umd.js'), 'utf8'),
};

const article = `<h1>Rendered heading</h1>${'<p>Paragraph text that a reader keeps, long enough to be an article body. </p>'.repeat(12)}<p>See <a href="/next">the next page</a>.</p>`;
const pending = new Set();
let localHits = 0;
const pages = {
  // Nothing in the HTML: the article only exists after the script fetched it.
  '/spa': (req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<title>SPA</title><body><main id=app>Loading</main><script>
      setTimeout(() => fetch('/data').then(r => r.json()).then(d => { app.innerHTML = '<article>' + d.html + '</article>'; }), 300);
    </script>`);
  },
  '/data': (req, res) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ html: article })); },
  // The head of the page arrives, the rest never does.
  '/slow': (req, res) => { pending.add(res); res.writeHead(200, { 'content-type': 'text/html' }); res.write('<html><body><h1>Early part</h1><p>' + 'x'.repeat(2048) + '</p>'); },
  '/hang': (req, res) => { pending.add(res); },
  '/report.pdf': (req, res) => { const b = Buffer.alloc(200000, 1); res.writeHead(200, { 'content-type': 'application/pdf', 'content-length': b.length }); res.end(b); },
  '/notes.txt': (req, res) => { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('plain words\nsecond line'); },
  '/long': (req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(`<pre>${'0123456789'.repeat(500)}</pre>`); },
  // The page keeps downloading past the transfer bound.
  '/big': (req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<p>Big page</p><script>for (let i = 0; i < 8; i++) fetch("/blob?" + i);</script>'); },
  '/blob': (req, res) => { res.writeHead(200, { 'content-type': 'application/octet-stream' }); res.end(Buffer.alloc(5 * 1024 * 1024, 7)); },
  // A public page that reaches for a service on this host, in every way a
  // page can: subresources, a redirect, a script navigation, a worker.
  '/public': (req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<p id=x>waiting</p><img src="${service}/img"><script>fetch('${service}/f').then(() => x.textContent = 'reached', () => x.textContent = 'refused')</script>`);
  },
  // WebRTC's ICE asks a STUN server on this host over UDP.
  '/webrtc': (req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<p id=x>rtc</p><script>const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:127.0.0.2:${stunPort}' }] }); pc.createDataChannel('d'); pc.createOffer().then(o => pc.setLocalDescription(o));</script>`);
  },
  '/redirect': (req, res) => { res.writeHead(302, { location: `${service}/via-redirect` }); res.end(); },
  '/navigate': (req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(`<p>Leaving</p><script>location.href = '${service}/via-script'</script>`); },
  '/worker': (req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<p>Worker page</p><script>new Worker(URL.createObjectURL(new Blob(["(async () => { await fetch('${service}/from-worker').catch(() => {}); for (let i = 0; i < 8; i++) await (await fetch('${base}/blob?' + i)).arrayBuffer(); })()"])));</script>`);
  },
  // Page-controlled metadata far beyond any sensible size.
  '/huge-title': (req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<p>Small page</p><script>document.title = 'T'.repeat(300000); const a = document.createElement('a'); a.href = '/' + 'x'.repeat(300000); a.textContent = 'y'.repeat(300000); document.body.append(a);</script>`);
  },
};
const server = http.createServer((req, res) => (pages[new URL(req.url, 'http://x').pathname] ?? ((q, r) => { r.writeHead(404); r.end('missing'); }))(req, res));
const local = http.createServer((req, res) => { localHits++; res.setHeader('access-control-allow-origin', '*'); res.writeHead(200, { 'content-type': 'text/html' }); res.end('<p>LOCAL-SECRET</p>'); });
let base;
let service;
let stunPort;
let stunPackets = 0;
const stun = dgram.createSocket('udp4').on('message', () => { stunPackets++; });
let browser;
// The test's sites all live on loopback; here only 127.0.0.2 counts as this
// host, so the pages on 127.0.0.1 stand for public sites.
const isLocal = ip => ip === '127.0.0.2';

before(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  await new Promise(r => local.listen(0, '127.0.0.2', r));
  await new Promise(r => stun.bind(0, '127.0.0.2', r));
  stunPort = stun.address().port;
  base = `http://127.0.0.1:${server.address().port}`;
  service = `http://127.0.0.2:${local.address().port}`;
  browser = await chromium.launch({ executablePath: shell, args: launchArgs });
});

after(async () => {
  for (const res of pending) res.destroy();
  await browser?.close();
  server.close();
  local.close();
  stun.close();
});

const read = (path, params = {}, signal) => readPage(browser, sources, { url: base + path, ...params }, signal, { isLocal });
const text = r => r.content[0].text;

test('a page that renders its article with JavaScript is read after it rendered', async () => {
  const r = await read('/spa');
  assert.match(text(r), /# Rendered heading/);
  assert.match(text(r), /Paragraph text that a reader keeps/);
  assert.doesNotMatch(text(r), /Loading/);
  assert.ok(r.details.links >= 1);
  assert.match(text(r), new RegExp(`\\(${base}/next\\)`));
  assert.equal(r.details.partial, false);
});

test('a page that never finishes loading returns what rendered within the bound', async () => {
  const started = Date.now();
  const r = await read('/slow', { timeout_seconds: 6 });
  assert.ok(Date.now() - started < 9000, `took ${Date.now() - started} ms`);
  assert.equal(r.details.partial, true);
  assert.match(text(r), /Early part/);
});

test('a server that never answers fails within the bound', async () => {
  const started = Date.now();
  await assert.rejects(read('/hang', { timeout_seconds: 5 }), /within 5 s/);
  assert.ok(Date.now() - started < 8000, `took ${Date.now() - started} ms`);
});

test('a download is reported as not a page, a text file is read', async () => {
  await assert.rejects(read('/report.pdf'), /not a web page \(application\/pdf/);
  const r = await read('/notes.txt');
  assert.equal(r.details.contentType, 'text/plain');
  assert.match(text(r), /plain words\nsecond line/);
});

test('long text is returned a slice at a time', async () => {
  const first = await read('/long', { max_chars: 1000 });
  assert.equal(first.details.chars, 5000);
  assert.equal(first.details.returned, 1000);
  assert.match(text(first), /offset 1000/);
  const last = await read('/long', { max_chars: 1000, offset: 4500 });
  assert.equal(last.details.returned, 500);
  assert.doesNotMatch(text(last), /call again/);
});

test('loading stops once the page transfers more than the bound', async () => {
  const r = await read('/big', { timeout_seconds: 20 });
  assert.equal(r.details.oversize, true);
  assert.match(text(r), /Big page/);
  // A worker's downloads count too.
  const w = await read('/worker', { timeout_seconds: 20 });
  assert.equal(w.details.oversize, true);
});

test('page-controlled titles and links stay bounded', async () => {
  const r = await read('/huge-title', { max_chars: 1000 });
  assert.ok(text(r).length < 10000, `returned ${text(r).length} characters`);
  assert.ok(JSON.stringify(r.details).length < 5000);
});

test('a read cancelled before it starts contacts nothing', async () => {
  const controller = new AbortController();
  controller.abort();
  const hits = localHits;
  await assert.rejects(readPage(browser, sources, { url: service + '/x' }, controller.signal, { isLocal }), /Cancelled/);
  assert.equal(localHits, hits);
});

test('only http and https are opened', async () => {
  for (const url of ['file:///etc/passwd', 'data:text/html,<p>x', 'chrome://version', 'not a url']) {
    await assert.rejects(readPage(browser, sources, { url }), /Only http|Not a URL/);
  }
});

test('a public page cannot reach a service on this host', async () => {
  const before = localHits;
  const r = await read('/public', { screenshot: true });
  assert.match(text(r), /refused/);
  assert.equal(r.content[1]?.mimeType, 'image/jpeg');
  const d = await read('/redirect');
  assert.doesNotMatch(text(d), /LOCAL-SECRET/);
  assert.doesNotMatch(text(d), /the site answered/, 'the proxy refusal must not read as the site\'s answer');
  assert.ok(d.details.refused >= 1);
  const n = await read('/navigate');
  assert.doesNotMatch(text(n), /LOCAL-SECRET/);
  await read('/worker', { timeout_seconds: 20 });
  await read('/webrtc');
  assert.equal(localHits, before, 'a public page reached the service');
  assert.equal(stunPackets, 0, 'WebRTC sent UDP past the proxy');
  assert.ok(r.details.refused >= 1);
});

test('the agent may read a service on this host itself', async () => {
  const r = await readPage(browser, sources, { url: service + '/own' }, undefined, { isLocal });
  assert.match(text(r), /LOCAL-SECRET/);
});

test('the proxy serves only this account and closes even with an idle connection open', async () => {
  const out = await egress({ allowLocal: false, maxBytes: 1024 });
  const port = Number(new URL(out.proxy.server).port);
  const idle = net.connect(port, '127.0.0.1');
  await new Promise(r => idle.on('connect', r));
  assert.equal(socketOwner(idle.localPort, port), process.getuid());
  assert.equal(socketOwner(1, port), -1);
  const started = Date.now();
  await out.close();
  assert.ok(Date.now() - started < 2000, `close took ${Date.now() - started} ms`);
  idle.destroy();
});

test("the host's own interface addresses count as this host", () => {
  const own = Object.values(networkInterfaces()).flat().map(i => i.address).filter(a => !a.startsWith('127.') && a !== '::1');
  for (const a of own) assert.equal(localAddress(a), true, a);
  assert.equal(localAddress('8.8.8.8'), false);
  assert.equal(localAddress('::ffff:10.1.2.3'), true);
});

// The real pinned Pi loads the extension from a core runtime layout and a
// synthetic model calls the tool. Where the host can start Chromium's
// sandbox, the page reaches the model; where it cannot, the tool refuses
// rather than run without it.
test('Pi offers read_page and the result reaches the model, sandboxed or not at all', async () => {
  const runtime = await mkdtemp(join(tmpdir(), 'oh-page-reader-'));
  const home = await mkdtemp(join(tmpdir(), 'oh-page-reader-home-'));
  const bodies = [];
  const sse = events => events.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
  const call = JSON.stringify({ url: base + '/spa' });
  const provider = http.createServer((req, res) => {
    let data = '';
    req.on('data', c => { data += c; });
    req.on('end', () => {
      bodies.push(JSON.parse(data));
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const item = bodies.length === 1
        ? { type: 'function_call', id: 'fc_1', call_id: 'call_1', name: 'read_page', arguments: call, status: 'completed' }
        : { type: 'message', id: 'msg_1', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'DONE', annotations: [] }] };
      res.end(sse([
        { type: 'response.created', response: { id: 'resp', status: 'in_progress', output: [] } },
        { type: 'response.output_item.added', output_index: 0, item: { ...item, ...(item.type === 'message' ? { content: [] } : { arguments: '' }), status: 'in_progress' } },
        ...(item.type === 'function_call' ? [{ type: 'response.function_call_arguments.delta', item_id: 'fc_1', output_index: 0, delta: call }] : []),
        { type: 'response.output_item.done', output_index: 0, item },
        { type: 'response.completed', response: { id: 'resp', status: 'completed', output: [], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } },
      ]));
    });
  });
  await new Promise(r => provider.listen(0, '127.0.0.1', r));
  try {
    await mkdir(join(runtime, 'page-reader'));
    await copyFile(extension, join(runtime, 'page-reader/extension.mjs'));
    await symlink(resolve(here, 'node_modules'), join(runtime, 'node_modules'));
    await symlink(browsers, join(runtime, 'browsers'));
    const sandboxed = await chromium.launch({ executablePath: shell, chromiumSandbox: true }).then(b => b.close().then(() => true), () => false);
    await writeFile(join(home, 'models.json'), JSON.stringify({ providers: { openai: { baseUrl: `http://127.0.0.1:${provider.address().port}/v1` } } }), { mode: 0o600 });
    const child = spawn(process.execPath, [cli, '--extension', join(runtime, 'page-reader/extension.mjs'), '--provider', 'openai', '--model', 'gpt-5.5',
      '--no-session', '--tools', 'read_page', '--thinking', 'low', '-p', 'read it'], {
      cwd: home, stdio: ['ignore', 'pipe', 'pipe'],
      env: { HOME: home, PATH: process.env.PATH, PI_CODING_AGENT_DIR: home, PI_OFFLINE: '1', OPENAI_API_KEY: 'synthetic' },
    });
    let out = '';
    child.stdout.on('data', c => { out += c; });
    child.stderr.on('data', c => { out += c; });
    const timer = setTimeout(() => child.kill('SIGKILL'), 45000);
    const started = Date.now();
    await new Promise(r => child.on('close', r));
    clearTimeout(timer);
    assert.equal(bodies.length, 2, out);
    const tool = bodies[0].tools.find(t => t.name === 'read_page');
    assert.ok(tool, JSON.stringify(bodies[0].tools));
    assert.deepEqual(tool.parameters.required, ['url']);
    const output = JSON.stringify(bodies[1].input.filter(i => i.type === 'function_call_output'));
    if (sandboxed) assert.match(output, /Rendered heading/);
    else assert.match(output, /cannot start its sandbox/);
    assert.match(out, /DONE/);
    // Pi exits when the turn is over, not when a read's or the idle
    // browser's timer runs out.
    assert.ok(Date.now() - started < 15000, `Pi took ${Date.now() - started} ms to exit`);
  } finally {
    provider.close();
    await rm(runtime, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});
