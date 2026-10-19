# Result: workspace editor beside the conversation (Rinnakkain)

Implemented in run `01m59z5qhnb264cenh38adtpf2` on 2026-10-19, on main after the browser shell
(285d2c87). The product side is complete; the live editor waits for the Fleetrepo editor host
(below).

## What the person gets

On a desktop, a conversation's header has **Editori**. It opens the workspace's own VS Code
(code-server) on the left and keeps the conversation as a column on the right, as in the
Rinnakkain prototype:

- The first open shows "Käynnistetään VS Code" while the daemon starts code-server (about 2–4 s
  measured behind the relays); later opens are instant, and the frame stays loaded while the
  editor is closed.
- The app sidebar steps aside while the editor is open; ☰ in the header brings it over the
  editor, Escape closes it.
- The divider drags (the frame does not swallow the drag), moves with the arrows (Shift for
  bigger steps, Home/End for the extremes), resets on double-click, and remembers its width in
  this browser. The column defaults to 30 % of the window, 440–640 px.
- Enter on the divider, or the header's hide button, hides the conversation into a 40-px strip
  that shows Pi's state and a new-reply mark; the strip brings it back.
- **Ctrl+Alt+K** (⌘⌥K) moves between the editor and the composer, and brings a hidden
  conversation back first. It works with focus inside VS Code too.
- Inline code in Pi's replies that names a workspace file (`internal/x.go:18`,
  `web/a.tsx:35-40`) is a link: it opens the editor if needed and shows the file at that line
  in the running window, keeping a mark on the link. A name that is not a file in the workspace
  says so and opens nothing.
- Not offered on phones (≤ 800 px): no button, and file names stay plain code.

## How it is built

- **Daemon** (`internal/daemon/editor_linux.go`): reads `/opt/open-habitat/editor.json` with
  `core.ReadOperatorFile`, trusts only a root-owned code-server tree, and starts code-server as
  the person on first use: `systemd-run --user` as `open-habitat-editor.service` under
  `/run/user/<uid>/open-habitat/editor/` when the account lingers and its user manager runs,
  otherwise its own child in its private `/tmp` (the process group is stopped with the daemon).
  The socket is `0600` in a `0700` directory, `--auth none`, `--config /dev/null` (no
  password file in the home), an environment built from scratch with `SHELL=/bin/bash`, idle
  stop from the operator file (default 30 min), `--reconnection-grace-time 600` and
  `--enable-remote-storage`. It relays `/editor-relay/…` to code-server (WebSockets included,
  without its own API deadlines), redirects the editor origin's workspace route to code-server's
  `?folder=`, and opens file links: workspace ID + relative path resolved with
  `openat2(RESOLVE_BENEATH|NO_XDEV)` to a regular file, then handed over a per-window Unix
  socket to the built-in extension (`internal/daemon/editor-extension/`, embedded and written
  next to code-server's own built-ins at each start). Nothing is stored beyond code-server's
  own data directory; the daemon keeps one in-memory timestamp (when a frame last started) to
  pick the right window.
- **Gateway** (`internal/gateway/editor_linux.go`): the editor origin comes from
  `oauth.editor_origin`; requests whose Host is that origin go to a handler of their own that
  never serves the app. `POST /auth/editor` (app write: Origin + CSRF) mints a one-minute
  single-use token; the editor origin's frame page redeems it (`POST /_open-habitat/handoff`,
  exact editor Origin) for `__Host-oh-editor` (Secure, HttpOnly, SameSite=Strict, in memory
  only, ends with its app session, at most 12 h). Every editor-origin request is relayed with an
  allow-list of headers (no cookies, no `X-Agent-Host-*`, no Authorization), writes and
  upgrades need the exact editor Origin, upstream `Set-Cookie`/`X-Frame-Options` are dropped,
  and every relay is registered under the parent app session, so logout, revocation and expiry
  close it, WebSockets included. The editor host sends `frame-ancestors 'self' <app origin>`;
  the app keeps `'none'`. `GET /api/v1/editor` and `POST /api/v1/editor/open` are ordinary app
  routes proxied to the daemon.
- **Frame page** (`internal/gateway/editor_bridge.js`, served by the gateway on the editor
  origin): asks the app for a token by postMessage, redeems it, starts the editor, loads the
  workbench in a frame of its own origin, and catches Ctrl+Alt+K in that frame before VS Code
  does. It accepts messages only from the app origin and its parent; the app accepts only its
  frame window's small vocabulary.
- **Web**: `WorkspaceEditor.tsx` (controller), `components/EditorSplit.tsx` (layout),
  `components/fileRefs.ts` + `MarkdownRenderer.tsx` (file links), `editor.ts` (host calls and
  width rules). The conversation sits in the same place in the tree whether the editor is open
  or not, so opening it never remounts or re-scrolls the conversation; a width change keeps the
  reading place.
- **Contract**: `contracts/v1/editor.schema.json` with examples.

## What Fleetrepo must provide (brief for `fleetrepo@open-habitat-editor-host`)

1. **Host name**: `open-habitat-test-code.example.test` — a first-level sibling of
   `open-habitat-test.example.test` (same registrable domain, so the cookie reaches the framed
   editor; covered by Cloudflare Universal SSL). Proxied DNS record.
2. **Ingress**: a cloudflared ingress rule sending that host to the same gateway listener as the
   app (alder → SSH forward → guest `127.0.0.1:8443`). WebSockets must pass (Cloudflare tunnels
   do). If Cloudflare Access is ever re-enabled, the editor host must be in the same Access
   application as the app (the gateway applies the same assertion check on both).
3. **Gateway certificate**: add the editor host to the SAN of the guest gateway's private-CA
   certificate.
4. **Gateway config**: `"editor_origin": "https://open-habitat-test-code.example.test"` inside the
   `oauth` object of `/etc/open-habitat/gateway.json`.
5. **code-server pin**: code-server **4.141.0** linux-amd64
   (`https://github.com/coder/code-server/releases/download/v4.141.0/code-server-4.141.0-linux-amd64.tar.gz`,
   sha256 `65bcd20b524d03eb1b5adb7f360244599ef0e5b74089a46a982d32c074b97a29`, as downloaded and
   verified here) unpacked into a root-owned, non-user-writable tree, e.g.
   `/opt/open-habitat/code-server/4.141.0/`, keeping its own layout
   (`bin/code-server`, `lib/vscode/extensions/`).
6. **Operator file**: `/opt/open-habitat/editor.json`, root-owned `0644`, single link, in
   root-owned non-writable directories:
   `{"code_server": "/opt/open-habitat/code-server/4.141.0/bin/code-server", "idle_timeout_seconds": 1800}`.
7. **Nothing for the extension**: it ships inside the product binary.
8. **Memory**: about 150 MiB per idle editor and 0.5–0.8 GiB per person with a folder, a file
   and a terminal open (research measurement); the test VM's per-user slices should allow it.
9. **Lingering**: already enabled by the broker (`broker-enable-linger`); with it the editor
   survives daemon restarts.

## Evidence

All on alder, synthetic homes and identities, tree after rebase onto 285d2c87.

- Go (umask 077, disk-backed TMPDIR): `go test ./internal/gateway ./internal/daemon
  ./internal/diagnostic ./internal/cli` pass. New tests: `TestEditorHandoffIsSingleUseAndBound`
  (CSRF/Origin on mint, editor-Origin-only redeem, single use, expiry, cookie attributes,
  Clear-Site-Data, logout ends the editor session), `TestEditorOriginIsolation` (neither cookie
  works on the other origin, editor paths reach code-server not the gateway, header allow-list,
  upstream cookie and frame denial dropped, frame headers on both origins, cross-origin writes
  and upgrades refused before the relay), `TestEditorRelayEndsWithAppSession` (logout,
  revocation and expiry close an upgraded relay on both sides),
  `TestEditorStartsOnceAsChildAndStopsWithDaemon` (arguments, no daemon environment, `0600`
  socket and `0700` directory, built-ins composed, started once, a cancelled or unanswered start
  leaves a live socket, the forked server dies with the daemon),
  `TestEditorStartsAsUserServiceWhenLingering` (systemd-run argv), `TestEditorRelayUpgrade`,
  `TestEditorFileStaysInsideWorkspace`, `TestEditorOpenTriesFocusedWindowFirst`,
  `TestEditorOpenRoute`, `TestEditorUnavailableWithoutOperatorConfig`.
- Contracts: `scripts/validate-contracts.py`, `scripts/check-generated.sh` clean.
- Web: `scripts/test-web-fast.sh` passes (incl. `editor.test.ts`); `web/tests/workspace-editor.spec.ts`
  (4 cases, incl. an axe check of the open state) passes, repeated; with
  `browser-shell`, `browser-conversation`, `composer-geometry`, `thread-fill` and
  `shell-accessibility`: 83 passed after the rebase. The full browser suite before the rebase:
  254 passed, 3 failed — one was mine (a warm conversation return read `/api/v1/editor`; fixed by
  reading it once per session), one passed alone (load flake), and
  `account-settings.spec.ts:379 native key add…` fails identically on unmodified main
  (pre-existing, not this change).
- **Real code-server 4.141.0** in a disposable `/var/tmp` directory behind the synthetic host
  (gateway + daemon handlers, `BROWSER_HOST_CODE_SERVER`), driven by `web/lab/probe-editor-engines.mjs`:
  hand-off → start → workbench (1.4–5 s), path:line opening in the running window, Ctrl+Alt+K from
  inside VS Code reaching the app.

  | Engine (Playwright 1.63) | `app.example.com` / `code.example.com` (production-shaped) | `*.oh.localhost` |
  | --- | --- | --- |
  | Chromium | works | works |
  | Firefox | works | works |
  | WebKit | works | cookie not kept in the frame (WebKit does not treat `*.localhost` siblings as one site; a test-name artifact) |

  The example.com runs used Playwright's own container under rootless Podman with the names
  mapped to loopback (WebKit lacks GTK/GStreamer libraries on alder).
- Lab captures with real code-server: `evidence/` (screenshot + static HTML each; the editor
  frame is omitted from the HTML twins): `l1366-1-keskustelu`, `l1366-2-linkki`,
  `l1366-3-piilotettu`, `d1920-linkki`, `puhelin-ei-editoria`. Script:
  `web/lab/capture-workspace-editor.mjs`.
- Independent review (critical rigor; finder gpt-6-astra, verifier claude-fable-5-1, triaged
  with `/assess-findings`): two confirmed findings. The start race (a cancelled or slow probe
  unlinked a live editor's socket) is fixed with a test. The shared editor origin finding is
  mitigated (Clear-Site-Data on every new editor session) and filed for Jari's decision as
  `dreadfully-breezy-carpenter`. One candidate (TOCTOU between path check and open, same UID)
  dropped: no boundary crossed.

## Not verified

- Real Safari's ITP with the framed sibling-host cookie (only Playwright WebKit).
- The live Cloudflare tunnel path to the editor host, and the guest's real lingering user
  manager starting `open-habitat-editor.service` (the systemd-run path is unit-tested with a
  stand-in; the child path ran with the real code-server).
- Distinct-UID evidence: the browser host uses one UID; the editor adds no new cross-user path
  (it relays only through the session's own mapped daemon socket, as every route does).

## Decisions for later review

- **Ctrl+Alt+K is caught by the editor origin's frame page, not by a code-server extension.**
  An extension runs in the extension host (Node, server side) and cannot reach the browser
  window. The frame page holds the workbench in a same-origin inner frame and sees the key before
  VS Code. The built-in extension does path:line only. Alternative: a code-server patch or
  product configuration, which is version-bound.
- **path:line goes app → daemon → extension over a per-window Unix socket**, not app → frame
  postMessage (VS Code's workbench exposes no API to the page) and not code-server's internal
  IPC protocol (version-bound). The daemon asks only windows that activated or were focused
  since the latest frame start, because code-server keeps closed tabs' extension hosts alive.
- **The extension is embedded in the binary and installed by composing a private built-in
  directory** (`--vscode-option builtin-extensions-dir=`, code-server's own built-ins linked
  plus ours), rather than installing into the person's extensions or the operator's
  code-server tree. Fleetrepo installs only code-server.
- **One shared editor origin with an interim Clear-Site-Data**, as the research accepted;
  per-person hosts left for Jari (`dreadfully-breezy-carpenter`). Clearing on every new editor
  session costs the browser-side workbench state, which is why `--enable-remote-storage` is on.
- **`--reconnection-grace-time 600`** (code-server default 10800): a closed or reloaded frame's
  extension host and terminals are kept 10 minutes instead of 3 hours, bounding memory. A laptop
  asleep longer than that reloads its editor window (files are on disk).
- **Editor sessions are in gateway memory, 12 h at most, SameSite=Strict, no Expires**: a
  gateway restart or browser restart starts a new hand-off silently. Alternative: persisting them
  beside app sessions, which would add a store for no need.
- **File links only from inline code in Markdown replies**, recognised by shape (a relative
  path with an extension, optional `:line`, `:line-end`, `:line:col`); the daemon checks
  existence on click. Alternatives: plain-text recognition or checking candidates in batch,
  which needs a file API (later work, as decided for phones).
- **The app sidebar hides while the editor is open; ☰ is in the conversation header**, since the
  product has no full-width top bar in multi-workspace mode. The header uses the narrow (phone)
  arrangement inside the editor column.
- **The frame stays loaded while the editor is closed** for instant reopening; it unloads when
  the person leaves conversation routes.
- **VS Code keeps its own theme and Workspace Trust** (the "Restricted Mode" banner): both are
  the person's native VS Code settings.
- **Status is read once per signed-in tab session**: whether an editor is offered changes only
  with the installation.
