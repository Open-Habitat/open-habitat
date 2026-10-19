# Go runtime packages

The security model is that each package here holds one authority and none acts
on another's behalf. The gateway authenticates a browser and decides which Unix
user it is talking to; a daemon runs as that user and touches only that user's
files and processes; root work is confined to the provisioning broker. If any
of these could do another's job, a bug in the gateway would be a bug with access
to homes, and a bug in a daemon would be one with access to other people's
identities. Moving an authority between packages, however convenient for the
task at hand, is therefore an architecture change: bring it to Jari as a
recommendation and record the decision in an issue, rather than settling it in
code.

The code is the description of how login, provisioning, conversations and
the event journal work (root `AGENTS.md`, "Code is the record"); the reasons
behind a boundary are in the history of the ADR or issue its comments name.
The packages divide the work as follows.

- `gateway/`: TLS, OAuth, sessions, CSRF, static UI, the revocation listener
  and the per-request proxy to the mapped daemon socket. `auth.go` is the
  login flow, `session.go` the per-request cookie and write checks,
  `proxy_linux.go` the forwarding, `terminal_linux.go` the browser shell's
  WebSocket relay.
- `daemon/`: discovery, Pi history reads, the conversation controller
  (`conversation_linux.go` for HTTP control, `pi_events_linux.go` for Pi event
  translation, `continuation_linux.go` for the ownership proof before Pi
  starts again, `held_linux.go` for messages held until Pi runs), the event
  journal (`events_linux.go`), GitHub and Pi onboarding, and the browser
  shell (`terminal_linux.go`: tmux sessions on a PTY, run as the person).
- `daemon/integrations/`: the integrations catalog (ADR 0026), run inside the
  person's daemon. Entries are product code; accounts are read from each
  tool's own files under catalog-owned names, logins are relayed through the
  browser, sync clients are supervised as the daemon's children, and the one
  personal-data skill is generated from what the tools hold.
- `provision/`: the root-only broker, its wire protocol, state and the Linux
  executor that creates accounts. It refuses to create or repair its own
  directories, socket permissions or units: a root process quietly fixing its
  environment would hide deployment drift.
- `transport/` carries the one-time GitHub token from gateway to daemon over
  the daemon's socket and holds the daemon's trusted configuration and binding
  checks; `nativegh/` installs the token into the person's `gh`. `transport`
  imports `gateway` and implements `gateway.TokenSink`, wired in `cli/`, so the
  gateway imports nothing from the daemon side.
- `udssecure/` decides from the file system whether a socket path is the daemon
  it claims to be. `core/` loads component configuration and the Pi runtime
  selector with their trust checks. `contracts/` is generated from
  `contracts/v1/`. `cli/` composes the roles into the one binary and is the
  operator surface (`CONFORMANCE.md`, `/ai-first-cli-canon`).

## Rules the code cannot show

The code shows what each component does; it cannot show what a component must
never do or never become. These rules were decided with Jari, most of them in
the ADRs now in history, and changing one is his decision.

Identity and authority:

- The browser never chooses a Unix account, daemon or UID. The gateway picks
  the daemon from the authenticated session's binding and builds the daemon
  request itself; browser-supplied identity headers, owners, UIDs and home
  paths carry no authority. The wire carries no Unix username, and the
  browser names workspaces, entries and worktrees by ID and token, never by
  path.
- The gateway cannot read homes or run agents. The broker trusts it to say
  who signed in, so it stays small and unprivileged.
- The broker has no network listener, no general command interface and no
  OAuth credentials. It never adopts an existing account: a taken or unsafe
  name needs an operator-approved alternative. It verifies the account,
  daemon configuration and socket before publishing a binding. Its only
  service start is the daemon of a committed, admitted person whose socket it
  has just restored and whose own boot signal exists; it starts no other unit
  and never pulls a socket in through the service's dependency. It may also
  enable lingering for a committed, admitted account, so that the person's
  native user services outlive daemon restarts. This adds no home read,
  credential access or host-owned state.
- `admission: "any"` exists for the disposable test installation only (ADR
  0014); it is not a production admission design.
- The GitHub token is held transiently by the gateway and handed once to the
  daemon. It is never persisted, logged or returned to the browser. A
  partial or uncertain native setup creates no web session, a later login
  reobserves native state instead of replaying a token, and an existing `gh`
  authorization for another identity, or credential storage that cannot be
  verified as safe, stops login rather than being replaced.
- An integration's token or password lives only in its tool's own store in
  the person's home; the daemon writes an app password there and keeps no
  copy, and the host keeps no list of connections. The browser pastes a
  provider redirect only as a loopback address, handed only to the tool the
  attempt started. `~/.local/state/open-habitat/sync-at-boot` exists exactly
  while the person has a syncing account; it is the one thing the root broker
  may look at in a home, and only for whether it exists.
- Model-provider keys live only in the person's Pi `auth.json`. The gateway
  forwards the write without parsing or logging it; replies carry presence
  and at most a literal key's four-character suffix; configured references
  are never resolved. The host keeps no credential store and no token copy.
- The browser shell runs as the person through the person's daemon, as Pi's
  bash already does; it grants nothing new. The gateway accepts its upgrade
  only from the exact app Origin, dials the daemon only after the session's
  CSRF proof arrives as the first message, caps terminals per session, and
  closes every relayed terminal when its session ends. A terminal never
  reaches another person's daemon or tmux server, and no shell-specific
  re-authentication is asked (Jari, 2026-10-19).
- Pi tool restrictions and approval prompts are guardrails inside the
  person's UID, not a sandbox. Observing a terminal Pi gives the daemon no
  ownership of it, and the daemon never reads another user's process
  details.

Native truth:

- No workspace registry, history, title, summary, observation or settings
  store of our own, and no cache without a measured performance problem; an
  in-memory derivation must be rebuildable from native files. Nothing about
  a worktree or an integration connection is stored by the host.
- Reading never starts Pi: opening, scrolling, reconnecting and status reads
  start nothing. Only a send or an explicit start does, after the ownership
  proof; terminal history stays read-only.
- An uncertain outcome stays uncertain. A missing receipt is not a
  rejection, a 503 does not mean nothing happened, an unavailable inventory
  is not an empty one, and neither the daemon nor the browser ever repeats a
  write, a prompt or a code submission automatically.
- One writer per browser conversation; an uncertain writer observation
  blocks the write.
- Taskfleet owns spinoffs: the daemon never starts, merges or writes to one
  for the browser, and reads its records read-only. The browser shell may
  watch a Taskfleet tmux window only read-only: in a view session of its
  own, with a read-only, ignore-size client sized to the window, and no
  input forwarded. Never use tmux's `destroy-unattached` on Taskfleet's
  server: with the detach hook it lost the whole tmux 3.6 server, every
  agent in it, in about one run in five.
- Shells are tmux's: the daemon keeps no list, buffer or record of them, and
  listing them never starts a tmux server.
- Destruction is explicit. A workspace goes to the freedesktop Trash, and
  permanent deletion happens only from the Trash on a typed request; a
  clean, fully pushed clone is the one outright deletion. An interrupted
  clone is only restarted or removed when the person asks. Nothing is
  purged automatically, and removal never follows a symlink or crosses a
  filesystem.
- Tokens, native error text and credential-bearing remote URLs never cross
  the contract; native failures reach the browser as fixed codes.
- Service diagnostics (JSONL on stderr, one journal per service) carry the
  component, event, outcome and a fixed reason, never raw errors,
  credentials, user content or command output. They are operational
  observations, not an audit trail.

## Traps

Two traps are worth knowing before touching this code.

`SO_PEERCRED` on a connection to a systemd-created socket reports PID 1 as
root, not the daemon that accepts, which is why the gateway verifies the socket
from the file system (`udssecure.Mapped`) and the daemon verifies the gateway
from the accepted connection. A test-mode dial to a locally bound socket sees
the daemon UID as peer, which is why `transport` has two branches there; they
look redundant and are not.

Almost everything here is `//go:build linux`; `nativegh/`, `transport/` and
`udssecure/` have no portable files at all, and `cli/`, `core/` and `gateway/`
do not build without them, so on a Mac `go vet ./...` and `go test ./...` fail
outright rather than run. Sessions normally run on `alder`, which is Linux, so
this bites when checking elsewhere. Several tests also skip when the runner is
not root, the filesystem lacks POSIX ACLs, or no nonroot mapped UID exists;
their `t.Skip` messages say which. The disposable QEMU guests in
`scripts/vm-test.sh` are where those paths are actually proven, so a green
`go test` on the dev box covers less than it looks, and after provisioning or
ACL changes it is worth running with `-v` to see what was skipped.

Generated-contract drift only arises when `contracts/v1/` or
`cmd/contractgen` changed; the generated check catches it. Test selection and
the full-gate policy are in the root `TESTING.md`.

Pi 1.3 RPC serializes assistant deltas without cumulative `partial` snapshots.
`toolcall_start` supplies the tool identity; later argument deltas do not. The
process relay therefore scopes identity to the current assistant message, and
status diagnostics are an allowlisted signal tail, not raw native frames.
Process selection in the browser retains the same owner/start-time fence as
HTTP controls: a selected short ID alone can silently become a different record.
