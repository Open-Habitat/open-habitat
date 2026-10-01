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
code. The reasoning behind the split is in `docs/architecture.md`, boundary by
boundary in `docs/interfaces.md` (Finnish, under identity and trust boundaries),
and for the broker in ADR 0004.

- `gateway/` owns same-origin HTTP, OAuth, sessions and CSRF, serves the static
  UI and routes each request to the mapped daemon over its per-user socket. The
  shared proxy checks the mapped socket once, forwards finite bodies within a
  cap and flushes streams without interpreting daemon replies. Conversation
  list filtering and create tracking remain until the lease-removal step. It
  runs as a fixed unprivileged UID, never reads a home, and never passes
  browser headers on as identity.
- `daemon/` runs as one mapped UID and owns native discovery, Pi history and
  child processes. The only identity it trusts is its own root-owned binding
  and the kernel's peer credentials; nothing the browser or the gateway asserts
  about who is calling is used. Binding, UID/home, Pi selector and pinned
  runtime tree/Node version are checked once before serving. Changing the
  binding or runtime requires a daemon restart. Missing first-use Pi credentials
  do not prevent startup; existing credential paths are checked when starting
  onboarding. Pi login status is an onboarding check, not a native-read security
  boundary: snapshot, history and streams never spawn a Pi status helper. Model-call authentication failures reach the browser only
  as a fixed code in the private conversation status.
- `provision/` is the root-only broker and Linux executor that create a
  person's Unix account on first approved login, with the wire protocol and a
  crash-safe journal. Fleetrepo owns the broker's directory, socket ACL, state
  and boot ordering, and this code refuses to create or repair them: a root
  process quietly fixing its own environment would hide deployment drift.
- `transport/` is the bounded HTTP/1.1 handoff that carries one transient
  GitHub token from the gateway to the daemon's socket, and `nativegh/`
  installs it into the person's own `gh` as their UID. `transport` imports
  `gateway` and implements the `gateway.TokenSink` interface, which `cli/`
  wires in, so the gateway imports nothing from the daemon side.
- `udssecure/` decides, from the file system, whether a socket path is the
  daemon it claims to be (see below).
- `core/` holds the component configuration and its trust checks; the
  config file and every directory above it have to be root-owned and not
  group- or world-writable before OAuth or handoff settings are believed.
- `contracts/` is generated from `contracts/v1/`; `contracts/AGENTS.md` explains
  the boundary and how drift is caught.
- `cli/` composes the roles into the one binary and is the operator surface,
  following the AI-first CLI canon (`CONFORMANCE.md`, `/ai-first-cli-canon`).

One trap is worth knowing before touching either end of a socket. When the
gateway connects to a daemon socket that systemd created and handed over,
`SO_PEERCRED` reports the process that called `listen()`, which is PID 1 as
root, not the daemon UID that later accepts. The gateway cannot learn from the
connection whom it reached, so `udssecure.Mapped` establishes it from the file
system instead: root-controlled traversal, a socket owned by the mapped UID in
the gateway's group, mode 0660. The daemon side has no such problem, because on
an accepted connection `SO_PEERCRED` names the real client, so it checks that
the peer is the gateway UID. A test-mode dial to a locally bound socket sees
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
