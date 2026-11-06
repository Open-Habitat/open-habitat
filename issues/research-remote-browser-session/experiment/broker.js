// Minimal per-user CDP broker: owns Chrome's --remote-debugging-pipe and
// exposes it as a WebSocket on a 0600 Unix socket in a 0700 directory.
const { spawn } = require('child_process');
const http = require('http'); const fs = require('fs'); const path = require('path');
const { WebSocketServer } = require('ws');
const [chrome, profile, sockDir, display, ...extra] = process.argv.slice(2);
fs.mkdirSync(sockDir, { mode: 0o700, recursive: true });
const sock = path.join(sockDir, 'cdp.sock'); try { fs.unlinkSync(sock); } catch {}
const child = spawn(chrome, ['--remote-debugging-pipe', '--user-data-dir=' + profile,
  '--no-first-run', '--no-default-browser-check', '--password-store=basic', ...extra, 'about:blank'],
  { stdio: ['ignore', 'inherit', 'inherit', 'pipe', 'pipe'], env: { ...process.env, DISPLAY: display } });
child.on('exit', (c, s) => { console.error('chrome exit', c, s); process.exit(0); });
const toChrome = child.stdio[3], fromChrome = child.stdio[4];
let client = null, buf = Buffer.alloc(0);
fromChrome.on('data', d => { buf = Buffer.concat([buf, d]); let i;
  while ((i = buf.indexOf(0)) >= 0) { const m = buf.subarray(0, i).toString(); buf = buf.subarray(i + 1);
    let j; try { j = JSON.parse(m); } catch { continue; }
    if (j.id >= 1e9) continue;                       // broker's own housekeeping replies
    if (j.method === 'Target.attachedToTarget' && !j.sessionId) sessions.add(j.params.sessionId);
    if (j.method === 'Target.detachedFromTarget' && !j.sessionId) sessions.delete(j.params.sessionId);
    if (client) client.send(m); } });
let sessions = new Set(), hid = 1e9;
const send = (method, params) => toChrome.write(JSON.stringify({ id: hid++, method, params }) + '\0');
function reset() { // Chrome cannot see a client leave the pipe: undo its CDP state
  send('Target.setAutoAttach', { autoAttach: false, waitForDebuggerOnStart: false, flatten: true });
  send('Target.setDiscoverTargets', { discover: false });
  for (const s of sessions) send('Target.detachFromTarget', { sessionId: s });
  sessions.clear(); }
const srv = http.createServer((req, res) => { // discovery for clients that want /json/version
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ Browser: 'pipe-broker', webSocketDebuggerUrl: 'ws://localhost/devtools/browser/pipe' })); });
const wss = new WebSocketServer({ server: srv, maxPayload: 256 << 20 });
wss.on('connection', ws => {
  if (client) { ws.close(1013, 'busy'); return; }   // one controller at a time
  client = ws; console.error('client attached');
  ws.on('message', m => toChrome.write(Buffer.concat([Buffer.from(m), Buffer.from([0])])));
  ws.on('close', () => { client = null; reset(); console.error('client detached'); });
});
srv.listen(sock, () => { fs.chmodSync(sock, 0o600); console.error('listening', sock); });
