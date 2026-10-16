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

What each component owns, how login and provisioning work, how a conversation
is fenced and continued, and what the event journal guarantees are described
in `docs/architecture/`; read the relevant page before changing a boundary.
The packages map onto those pages as follows.

- `gateway/`: TLS, OAuth, sessions, CSRF, static UI, the revocation listener
  and the per-request proxy to the mapped daemon socket. `auth.go` is the
  login flow, `session.go` the per-request cookie and write checks,
  `proxy_linux.go` the forwarding. See identity-and-trust.
- `daemon/`: discovery, Pi history reads, the conversation controller
  (`conversation_linux.go` for HTTP control, `pi_events_linux.go` for Pi event
  translation, `continuation_linux.go` for the continuation proof), the event
  journal (`events_linux.go`), GitHub and Pi onboarding. See conversations,
  events-and-recovery and workspaces.
- `provision/`: the root-only broker, its wire protocol, state and the Linux
  executor that creates accounts. It refuses to create or repair its own
  directories, socket permissions or units: a root process quietly fixing its
  environment would hide deployment drift. See identity-and-trust.
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
