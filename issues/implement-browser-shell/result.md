# Result: browser shell, Paneeli

The browser shell Jari accepted on 2026-10-19 (direction Paneeli of
`proto-browser-shell`, slice 1 of `research-shell-editor`) is implemented.

- **Daemon** (`internal/daemon/terminal_linux.go`, `pty_linux.go`): a
  workspace's shells are tmux sessions on the product's own tmux server, run
  as the person on a PTY in the workspace directory with `SHELL=/bin/bash` and
  an environment built from scratch. With lingering (the linger file plus a
  user bus) the server is started by `systemd-run --user` as
  `open-habitat-tmux.service` under `/run/user/<uid>/open-habitat/`;
  otherwise it is the daemon's child in its private `/tmp`, and the list and
  `ready` say `survives_restart: false`. Routes: list (GET), close (POST),
  upgrade (GET, `shell=new|<n>` or `taskfleet=<token>`). Listing never starts a
  server. Taskfleet windows working in the workspace (pane path in the
  workspace or its `__worktrees` sibling) are shown read-only by reading the
  pane with `capture-pane`, never by attaching a client.
- **Gateway** (`internal/gateway/terminal_linux.go`, `internal/wsframe/`):
  exact Origin on the upgrade; the CSRF proof is the first WebSocket message
  and is checked before the daemon is dialed; at most 8 terminals per browser
  session; the relay is registered with the session (`liveRequest`) and both
  connections close on logout, revocation, idle or absolute expiry, also
  while the handshake is in progress. After that it relays bytes.
- **Contract**: `contracts/v1/terminal.schema.json` (list, close, socket
  messages), examples, scenario CT-038, regenerated packages.
- **Web**: xterm.js 6.0.0 and `@xterm/addon-fit` 0.11.0 (both MIT, license
  files checked, pinned). `TerminalPanel` and `TerminalSurface` in
  `web/src/components/`, the app glue in `web/src/app/BrowserShell.tsx`, the
  toggle in the conversation header (browser and native-history views).
  Tabs, Ctrl+`, resize grip, maximise, hide, first-open dialog, busy close
  confirmation, multi-line paste confirmation, copy and Vie keskusteluun
  (also from tmux's own mouse selection via OSC 52), phone key row with sticky
  Ctrl/Alt, offline state with reconnect.
- **Docs**: `internal/AGENTS.md` (rules for the shell and the Taskfleet view),
  `docs/operations.md` (tmux, lingering, limits), `TESTING.md` (new
  distinct-UID check).

## Evidence

Tree tested: commit `9bc912fc` plus the test-only follow-up; synthetic only.

- Go: `go vet ./...`; `go test ./internal/... ./test/... ./cmd/...` all ok.
  New: `internal/wsframe` (RFC accept key, length boundaries, rejections),
  gateway terminal tests (cross-origin and missing-Origin upgrade refused
  before the daemon, missing/wrong/extra-field CSRF proof refused before the
  daemon, frames relayed and daemon refusals mapped to close codes,
  logout/revoke/idle/absolute expiry close both sides, session end during
  the handshake reaches nothing, per-session cap and release), daemon
  terminal tests against real tmux 3.6 (PTY as the test UID in the workspace
  directory, resize via `stty size`, background job survives disconnect and
  reattach, `exit` ends the session, busy reporting, close, Taskfleet watch:
  no input reaches the window, no client attached, window size unchanged and
  followed, view ends with the window; refusals; lingering path through a
  systemd-run stand-in).
- Distinct UIDs: `./scripts/test-terminal-uids.sh` passed (rootless
  container, UIDs 21001/21002 and gateway 21003): each shell runs as its
  person in its workspace, cannot list the other's home or reach the other's
  tmux socket, the people's UIDs cannot connect to each other's daemon
  sockets, the tmux servers are owned by their person, and a background job
  survives reconnecting.
- Contracts: `./scripts/test-focused.sh --area contracts` clean.
- Web: `./scripts/test-web-fast.sh` passed; `npm run storybook:test` built;
  `scripts/check-licenses.py` valid.
- Browser: `tests/browser-shell.spec.ts` (tabs and Ctrl+`, hide keeps shells
  running, busy close confirmation, exit, paste confirmation, Vie
  keskusteluun, phone key row, connection loss and reconnect, session end) 16/16
  with `--repeat-each=4 --workers=2`. Full default suite at `--workers=2`:
  253 passed, 4 failed: the known pre-existing `account-settings.spec.ts:379`
  (native key add), two load flakes that passed on rerun
  (`browser-conversation` daemon restart and rail home), and the warm-return
  test, which now allows the one mount-time shell-list read. Lab suite 55/55.
- Lab captures beside the round: `evidence/` (empty, first open, tabs light
  and dark, paste, selection, sent to composer, phone, connection lost),
  made with `web/lab/capture-browser-shell.mjs`. Compared with
  `issues/proto-browser-shell/shots/1-paneeli-*` and `yhteinen-*`: same
  placement, tab bar, tools, hint row, key row, paste bar, selection chip and
  offline pill. Differences: no tmux button when no Taskfleet window works in
  the workspace (the round's showed the person's own sessions); the round's
  app-wide banner for connection loss is not shown when only the terminal
  socket drops (the app is still connected).
- Review: `/llm-review` at critical rigor (finder GPT-6 Astra, verifier
  Claude Fable 5.1), triaged with `/assess-findings`: 4 confirmed and fixed in
  this run (relay closed during the handshake on session end; Taskfleet view
  could resize the agent's window, now pane-reading; no automatic reopen of an
  uncertain new shell; large paste chunked), 1 dropped (HTTP/2 on list/close,
  same as the deployed git routes and unreachable through the ingress).

Not verified: a real systemd user manager with lingering (the shell surviving
a daemon restart), which waits for `broker-enable-linger` and a VM run;
WebSockets through the live Cloudflare route; real phones' on-screen
keyboards.

## Decisions for later review

- **One tmux session per tab**, named `<workspace dir>-<id6>-<n>`, rather than
  windows of one workspace session. Alternatives: windows in one session with
  grouped view sessions per tab. Chosen because `exit` then ends exactly its
  tab, two devices on one tab see the same screen as two tmux clients would,
  and no grouped sessions or hooks are needed. Tab names are the session's
  current window name (tmux renames it after the running program).
- **Taskfleet windows are read by `capture-pane` every 500 ms**, not
  attached. Alternatives: `attach -r` in a grouped view session with
  `ignore-size` (tried; it still resized the agent's window once Taskfleet's
  own client left, and with `destroy-unattached` plus a detach hook it lost
  the whole tmux 3.6 server about one run in five), or control mode. Reading
  is read-only by construction and writes nothing to Taskfleet's server; the
  cost is a half-second refresh and no scrollback.
- **Only the visible tab holds a connection**; switching tabs reattaches
  (tmux redraws). Alternative: one socket per open tab. Fewer connections
  against the per-session cap and the daemon's 16-connection limit.
- **CSRF proof in the first message, checked by the gateway before dialing**,
  as the item says; the daemon never sees an unproven connection. Alternative:
  `Sec-WebSocket-Protocol`, which proxies may log.
- **Own minimal RFC 6455 package** (`internal/wsframe`) instead of a Go
  WebSocket library: the gateway must read exactly one frame and then relay
  raw bytes, which libraries do not expose; the repository has no third-party
  Go modules beyond dbus.
- **`survives_restart` is in the shell list and `ready`, not the global
  snapshot**: the snapshot is read often and would need a linger probe on
  every read.
- **Not-surviving shells are said in the first-open dialog, the empty state
  and the hint row**, not hidden.
- **The person's own tmux sessions on the default socket are not listed**
  (the round showed them): inside the daemon's `PrivateTmp` they are
  invisible, and the browser is meant to be the person's route to the server.
- **Panel also in the native-history (read-only) conversation view**, without
  Vie keskusteluun since there is no composer.
- **Paste wording**: ”Pääte saa ne kuin kirjoitettuina, ja komentotulkki voi
  ajaa ne heti” and button Liitä, instead of the round's ”rivi kerrallaan” and
  Liitä ja aja: bash's bracketed paste holds the lines until Enter.
- **Input typed while a tab is connecting is dropped**, not queued; the
  terminal shows ”Yhdistetään päätteeseen…”.
- **A lost connection reconnects with backoff (1 s … 10 s)**; a lost `new`
  connection never reopens a shell automatically.
- **tmux options set on product sessions only**: `status off`, `mouse on`
  (wheel scrolls tmux history; Shift-drag selects in the browser, and tmux's
  own selection reaches the chip by OSC 52). The person's tmux.conf is still
  read.
- **Limits**: 16 shells per workspace, 16 terminal connections per daemon, 8
  per browser session, 64 KiB per socket message (the browser sends 16 KiB
  slices).

The prototype round directory stays in the tree; moving the chosen direction
into `design-system/prototypes/lib/` and refreshing the drafts was not part of
this work.
