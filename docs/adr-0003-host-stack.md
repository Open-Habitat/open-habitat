# ADR 0003: Use one Rust host binary, systemd services and Unix sockets

**Status:** Proposed

**Date:** 2026-09-22

**Authors:** Pi, for review by Jari Mustonen

## Context

ADR 0001 requires one authenticated gateway and one daemon under each supported
Linux user's UID. The gateway must not read users' homes or hold their native
agent, Git or GitHub credentials. Each daemon must read that user's native
workspaces and Pi histories and run agents with that user's existing environment.
The browser boundary is JSON/HTTP plus one cursor-marked SSE feed. ADR 0002
proposes a static React build served from the same origin.

The first host is Alder with two Unix identities. The host must survive browser
loss, reject cross-user routing, retain native Pi history, respect Taskfleet's
ownership of its worktrees, and recover honestly from gateway, daemon and host
restarts. Pi 0.85.1 supplies JSONL RPC only over a child process's standard
input/output. It has no live terminal-TUI attach API and does not prevent two
processes from resuming the same session. Discovery, process liveness, process
ownership and controllability are therefore separate facts.

This decision chooses a proposed implementation and deployment stack. It does
not accept the stack or claim that its commands exist. `review-implementation-plan`
must accept the exact version, authentication, unit and pilot contract before
product implementation or Alder deployment.

## Decision

### One Rust codebase and one release artifact

Subject to that review, implement both gateway and daemon in one Rust workspace
and ship one `native-agent-host` binary with `gateway`, `daemon`, `check-config`
and version subcommands. Use Rust 1.98.1 as the initial toolchain, Tokio 1.53.1
for async work, Axum 0.8.9 for HTTP/SSE, rustls 0.23.45 where application TLS is
needed, `openidconnect` 4.0.1 for browser authentication, and tower-http 0.7.1
for bounded HTTP middleware and static files. Commit `Cargo.lock`; pin the first
scaffold and review dependency updates.

One language and artifact keep types, error envelopes, logging, release checks
and Linux primitives together. The gateway and daemons remain separate
executables at runtime with different UIDs and systemd restrictions. Shared code
does not create shared authority.

Build the React client separately and embed or package only its immutable
`web/dist/` output beside the binary. Node is a build dependency, not a service
runtime. The gateway serves those files, returns `index.html` only for known UI
routes, and never uses that fallback for `/api/`, `/events`, `/auth/`,
`/healthz` or `/readyz`.

### Browser authentication and fixed account mapping

Use OpenID Connect Authorization Code flow with PKCE, state and nonce. The pilot
uses one configured provider and an exact HTTPS redirect URI. Do not add local
passwords, PAM-over-HTTP or browser-visible Unix-account selection.

A root-owned configuration maps an immutable verified `(issuer, subject)` pair
to exactly one existing Unix username. Email and display name may be shown, but
are not routing keys. Duplicate subjects, duplicate Unix targets where the
policy requires one web identity, missing users, non-regular config files and
unknown subjects fail closed. An unknown identity receives a generic denied
page and a correlation ID; an operator may inspect the redacted audit event and
add an explicit mapping through Fleetrepo. The browser cannot submit or override
the username, socket path or UID.

After the callback, create an opaque random server-side session. Send only a
`__Host-agent-host` cookie with `Secure`, `HttpOnly`, `SameSite=Lax` and
`Path=/`. Rotate the session ID at login. The proposed pilot limits are 8 hours
idle and 24 hours absolute. Every state-changing request also requires the exact
same-origin `Origin` and a session-bound CSRF token in a custom header. `POST
/auth/logout` validates CSRF, invalidates the server record and expires the
cookie. Logout does not stop agents and does not promise to log the user out of
the external identity provider. Expiry or gateway restart invalidates web
sessions; already rendered content may remain visibly stale, but all reads and
writes require reauthentication before another identity can be shown.

The OIDC client secret and session-signing/randomness material are gateway
service credentials, not native user credentials. Supply them through systemd's
credential mechanism from Fleetrepo-managed encrypted input; do not put them in
argv, environment, the browser bundle, logs or repository plaintext. Pi, Git,
SSH and `gh` credentials stay exclusively in each mapped user's native files and
agent environment. The gateway never receives or brokers them.

For the Alder pilot, terminate public HTTPS with the already managed Tailscale
Serve path and proxy only to the gateway on `127.0.0.1:17870`. The gateway still
performs OIDC and never trusts browser-supplied identity headers. Bind the
loopback listener exclusively and configure the stable Tailscale HTTPS name as
the OIDC origin. A later non-Tailscale deployment must provide an equally
reviewed TLS terminator or use rustls directly; plain LAN HTTP is not supported.

### Gateway-to-daemon routing and authentication

Use HTTP/1.1 over one systemd-created Unix-domain socket per configured Unix
user, for example `/run/native-agent-host/jari.sock`. The socket unit owns the
path as that user, gives the gateway group connect permission with mode `0660`,
and passes the listener to the matching daemon service. Supported human users
are not members of the gateway group.

The gateway chooses a socket only from its static identity mapping. Usernames do
not appear in public API paths or forwarded browser fields. Before serving a
connection, the daemon checks Linux `SO_PEERCRED` and accepts only the fixed
`native-agent-host-gateway` UID. It also verifies that its configured username,
real/effective UID, home and socket instance agree. No shared bearer token is
needed on the local hop. The socket path provides routing; kernel peer
credentials provide local authentication. A mismatch is an audited denial, not
a fallback to another user.

Run the gateway as a dedicated fixed system user with no home access and no
supplementary human groups. Use a fixed identity rather than `DynamicUser`
because daemons compare the peer UID. Apply systemd hardening including an empty
capability set, `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome=yes`,
private devices and temporary files, restricted address families, kernel and
control-group protection, namespace restrictions and `UMask=0077`. Permit only
its root-owned mode-0640 non-secret config, loaded credentials, read-only release
assets, gateway runtime directory and configured user sockets. The HTTP listener
is loopback-only. OIDC Code flow also requires outbound DNS and HTTPS to the
configured issuer's discovery/JWKS/token endpoints; the reviewed unit and host
firewall must allow that path without exposing another listener.

Install `native-agent-host-daemon@.socket` and
`native-agent-host-daemon@.service` as root-owned system templates. Each service
uses `User=%i` and `Group=%i`; systemd changes UID before the binary runs. The
daemon needs no root or setuid path and never switches users itself. Use
`KillMode=mixed`, a reviewed `TimeoutStopSec`, `Restart=on-failure`, an empty
capability set, `NoNewPrivileges=yes`, `ProtectSystem=full` and `ProtectHome=no`.
On SIGTERM the daemon rejects new writes, asks controlled Pi runs to abort and
settle, waits for their exit, then exits; after the timeout systemd kills all
remaining children. Do not use `PrivateTmp` because native tools and Taskfleet
may own work below the shared temporary root. Only the two explicitly configured
socket instances are enabled.

A system service does not inherit a login shell. Set `HOME=%h`, `USER=%u`,
`LOGNAME=%u`, `XDG_RUNTIME_DIR=/run/user/%U` and an explicit PATH containing
`%h/.local/bin`, `%h/bin` and the system directories. Require the user manager's
runtime directory to exist through linger. Optionally read a user-owned,
mode-0600 `%h/.config/native-agent-host/environment` for native tools that need
stable environment variables such as `SSH_AUTH_SOCK`; never source shell startup
files or parse a command string. The daemon starts an absolute, preflighted Pi or
Taskfleet executable with argv. `check-config --component daemon` runs under the
same UID/environment and fails readiness when an executable, runtime directory,
credential file or required variable is missing. This file remains native
same-user configuration, not a gateway-visible credential broker.

### Pi adapter and process ownership

The daemon owns an in-memory controller for every Pi RPC process it starts. It
starts Pi directly under the daemon's UID and workspace cwd, using the verified
native forms such as `pi --mode rpc --session <session>` for resume. It consumes
strict JSONL on stdout, writes strict JSONL commands on stdin, captures bounded
stderr diagnostics, and translates supported events without copying Pi history.
A fresh agent uses Pi's native session directory and returns the native session
ID once Pi creates it.

Enforce one daemon-controlled writer for each `pi:<sessionId>` with a per-session
advisory lock in mode-0700 `/run/user/<uid>/native-agent-host/` plus the daemon's
in-memory owner map. The lock is coordination, not an agent registry or history. It does
not prove that an external terminal process is absent. Before start, resume,
transfer, deletion or stop, take a fresh snapshot of Pi history, the daemon's
child/cgroup ownership, `/proc`, tmux and Taskfleet facts. Unknown observation
fails closed for writes.

Browser and SSE connections never own the child. Closing a tab or losing the
network leaves the daemon and Pi RPC child running. A bounded daemon event ring
supports cursor replay; an expired cursor causes a native resnapshot. Durable
Pi entry IDs remain history cursors, while transient RPC events receive daemon
cursors. The exact retention and command-ID ledger belong to the host contract,
not this ADR.

The daemon is the process owner, so an intentional daemon restart first stops
accepting writes, asks controlled Pi runs to settle/abort within a bounded grace
period, and then relies on systemd's control group to kill any remainder. A
daemon crash likewise stops its Pi children; active model work does **not**
survive daemon death or host reboot. Pi's completed JSONL history does survive.
After restart, the daemon rediscovers history and reports the interrupted run;
it may offer a deliberate resume only after it proves the old writer is gone and
history has settled. Do not add a sidecar supervisor merely to preserve active
work until measurements show that daemon-restart survival is required.

A detected terminal TUI remains history-only. There is no RPC attach. Transfer
requires either a stop through a currently known owner or an explicit user stop
in the terminal, followed by proof that the process exited and history settled;
only then may the daemon start RPC on the same native session. The daemon never
signals a merely observed PID. A Taskfleet-created worktree and run remain owned
and torn down by Taskfleet. Agent Host invokes and observes Taskfleet's supported
CLI/API and does not substitute direct `git worktree` or process killing.

Client command IDs are scoped to the authenticated identity and operation. The
daemon records a bounded idempotency outcome for accepted commands and reconciles
it with a fresh snapshot. If a connection fails before acceptance can be proved,
the result stays uncertain and is never automatically resent.

### Logs, health and version checks

Both process types write structured JSON logs to stdout/stderr for journald.
Include timestamp, level, component, release version, request/correlation ID,
Unix account where operationally necessary, operation stage and stable error
code. Do not log cookies, OIDC tokens or secrets, prompts, model output, tool
payloads, file contents, full command lines, native credential metadata or raw
session files. Journal access remains an operator privilege; per-user content is
not copied into a gateway log.

The binary provides `native-agent-host version --json` and
`native-agent-host check-config --component gateway|daemon --json`.
The public same-origin `/healthz` and `/readyz` return only aggregate
live/ready status, no usernames, UIDs, versions, mappings or daemon counts.
Detailed readiness and maintenance use a separate mode-0660 gateway-admin Unix
socket reachable only by the fixed gateway account and root. That endpoint
reports each configured daemon as reachable, unavailable or version-incompatible
for operator commands. Each daemon's UDS `/healthz` reports its UID, version and
adapter readiness only to an authenticated gateway peer. User-data smoke tests
remain authenticated API checks under each identity, not health endpoints.

## Service topology

```text
Tailscale HTTPS / stable pilot name
  -> Rust gateway (fixed native-agent-host-gateway UID, loopback :17870)
       -> OIDC session maps (issuer, subject) to one fixed socket
       -> /run/native-agent-host/jari.sock
            -> Rust daemon as UID jari -> Pi RPC, Git, gh, tmux, Taskfleet
       -> /run/native-agent-host/kaisa.sock
            -> Rust daemon as UID kaisa -> her native tools and files
```

The gateway can route and serve static files. It cannot open either home through
its Unix permissions. Each daemon can do what its Unix user can do, including
running shell-capable agents; same-UID restrictions are guardrails, not a
sandbox. A compromised root or system manager remains outside this separation
claim.

## Packaging, installation, update and rollback

CI builds and tests the locked workspace, builds `web/dist/`, and emits a
checksum-signed release archive for `x86_64-unknown-linux-musl`. The archive
contains the static binary, frontend assets, systemd service/socket units,
sysusers and tmpfiles declarations, default non-secret config, licenses and a
manifest. Install complete immutable releases under
`/opt/native-agent-host/releases/<version>/` and atomically select
`/opt/native-agent-host/current`. Keep the immediately preceding verified
release. Mutable account mapping lives under `/etc/native-agent-host/`; user
annotations remain under each user's XDG state directory; native histories,
workspaces and credentials are never placed below `/opt`.

Fleetrepo is the sole owner of Alder's persistent installation. Its future fleet
change must add explicit system and package facts, exact release URL/version and
SHA-256, the approved human-account prerequisite, gateway user/group, public and
admin sockets, units, mapping, encrypted OIDC credential input, Tailscale Serve
declaration and read-only check. It must reject unmanaged conflicting
paths and never install a local source build as machine state.

The following are exact **proposed command shapes**, not currently executable
product instructions. The implementation and Fleetrepo changes must preserve
these names or update this ADR at review:

```sh
# Build and package in CI or a disposable builder
npm ci --prefix web
npm run build --prefix web
cargo test --locked --workspace
cargo clippy --locked --workspace --all-targets -- -D warnings
cargo build --locked --profile dist --target x86_64-unknown-linux-musl
./scripts/package-release.sh --version "$VERSION" \
  --target x86_64-unknown-linux-musl --web-dir web/dist --output dist/
(cd dist && sha256sum --check \
  "native-agent-host-${VERSION}-x86_64-unknown-linux-musl.tar.xz.sha256")

# Commands use Rowan as the authorized seat/jump. A stdin script is forwarded
# through both SSH hops so shell operators and ~ are evaluated only on Alder.
ssh rowan 'ssh alder /bin/bash -s' <<'ALDER'
set -euo pipefail
cd "$HOME/Sources/fleetrepo"
fleetrepo fleet component list --json
fleetrepo fleet status --json
fleetrepo fleet doctor --json
ALDER

# Apply the reviewed system-scoped release/config/unit declaration as root.
# The concrete hook is created by Fleetrepo and accepted at review.
ssh rowan 'ssh alder-root /bin/bash -s' <<'ALDER_ROOT'
set -euo pipefail
cd /home/maintainer/Sources/fleetrepo
DOTFILES_HOSTNAME=alder dotfiles/setup.d/native-agent-host.sh
ALDER_ROOT

# Verify declared state and public aggregate health without content.
ssh rowan 'ssh alder /bin/bash -s' <<'ALDER'
set -euo pipefail
cd "$HOME/Sources/fleetrepo"
DOTFILES_HOSTNAME=alder dotfiles/setup.d/native-agent-host.sh --check
fleetrepo fleet doctor --json
/opt/native-agent-host/current/native-agent-host version --json
systemctl is-active native-agent-host-gateway.service \
  native-agent-host-daemon@jari.socket \
  native-agent-host-daemon@kaisa.socket
curl --fail --silent --show-error https://HOSTNAME/healthz
curl --fail --silent --show-error https://HOSTNAME/readyz
journalctl -u native-agent-host-gateway.service \
  -u 'native-agent-host-daemon@*.service' --since -15min --no-pager
ALDER

# Detailed config/readiness runs in the service credential/UID context.
ssh rowan 'ssh alder-root /bin/bash -s' <<'ALDER_ROOT'
set -euo pipefail
runuser --user native-agent-host-gateway -- \
  /opt/native-agent-host/current/native-agent-host check-config \
  --component gateway --json
runuser --user native-agent-host-gateway -- \
  /opt/native-agent-host/current/native-agent-host admin readiness --json
ALDER_ROOT
```

Before update or rollback, root invokes the admin client as the fixed gateway
account. `maintenance-preflight --enter` makes the gateway and daemons reject new
writes, then waits for every daemon-owned Pi writer to settle and exit. A nonzero
or incomplete result blocks activation. The Fleetrepo hook stops both `.socket`
units before their `.service` units, verifies that none can be socket-activated,
selects the release, and starts sockets only after config checks pass. Detailed
readiness never probes an inactive socket, so it cannot reactivate an old daemon.
Never restart daemons underneath active work merely because package activation
is atomic.

```sh
# Proposed update preflight, after the new Fleetrepo pin/hash is reviewed and landed.
ssh rowan 'ssh alder-root /bin/bash -s' <<'ALDER_ROOT'
set -euo pipefail
runuser --user native-agent-host-gateway -- \
  /opt/native-agent-host/current/native-agent-host admin \
  maintenance-preflight --enter --json
cd /home/maintainer/Sources/fleetrepo
DOTFILES_HOSTNAME=alder dotfiles/setup.d/native-agent-host.sh
runuser --user native-agent-host-gateway -- \
  /opt/native-agent-host/current/native-agent-host admin readiness --json
ALDER_ROOT
ssh rowan 'ssh alder /bin/bash -s' <<'ALDER'
set -euo pipefail
cd "$HOME/Sources/fleetrepo"
DOTFILES_HOSTNAME=alder dotfiles/setup.d/native-agent-host.sh --check
/opt/native-agent-host/current/native-agent-host version --json
curl --fail --silent --show-error https://HOSTNAME/readyz
ALDER

# Proposed rollback preparation: in Fleetrepo, revert the release declaration,
# review, commit and push it through the normal workflow. Then run the same root
# maintenance-preflight + hook and the same unprivileged checks shown above.
git -C "$HOME/Sources/fleetrepo" revert <native-agent-host-release-commit>
```

An update is successful only after version, config, units, authenticated
same-user reads, wrong-user denials, SSE reconnect and one disposable Pi turn
pass. Rollback must prove the selected old version and repeat the same checks.
The release switch does not roll back or rewrite native history, Git state,
workspace settings or user annotations.

## Disposable two-user test and Alder pilot

Before Alder, run a disposable Linux VM with systemd as PID 1, the exact release
archive, two synthetic users (`agent-a`, `agent-b`), a dedicated gateway user,
synthetic homes and a fake OIDC issuer or deterministic authentication test
fixture. Do not bind host homes, credentials or SSH agents. Create distinct
sentinel workspaces and Pi session fixtures. Exercise both positive routes and
these negative cases:

1. subject A cannot select B, connect to B's socket, read B's snapshot or receive
   B's SSE event;
2. a browser-supplied identity/Unix header is stripped and ignored;
3. an unknown/duplicate mapping, wrong socket owner/mode, wrong peer UID and
   unavailable daemon all fail closed;
4. native credentials are absent from gateway files, environment, `/proc`, HTTP,
   static assets and logs;
5. browser/SSE loss leaves a controlled Pi child alive and reconnect deduplicates;
6. gateway restart logs web sessions out but leaves daemons/agents alive;
7. daemon crash kills its controlled child, preserves Pi JSONL and permits only a
   deliberate, single-writer resume after exit/settlement proof;
8. terminal-TUI and unknown-process fixtures remain read-only; only a known-owner
   transfer can progress;
9. Taskfleet fixture teardown uses Taskfleet, and staged host-operation failures
   preserve truthful partial results; and
10. update and rollback preserve native files and reject activation while a
    managed writer is active.

Reset destroys the entire VM and its synthetic users. No test account, OIDC
secret, release, unit or credential survives outside the fixture artifacts.

After those tests and `review-implementation-plan` acceptance, the Alder pilot
may use the already authorized target. The 2026-09-22 read-only inventory found
`jari` but no `kaisa` Unix account. The review must therefore approve the
exact Fleetrepo declaration for creating that ordinary account (UID allocation,
home, shell, groups and linger) before any socket is enabled; absence continues
to fail closed. Fleetrepo also creates the fixed gateway user, enables exactly
the `jari` and `kaisa` socket instances, installs the reviewed release,
mapping and encrypted OIDC credential, and converges the Tailscale HTTPS route.
No product command runs as either human to copy credentials. Each account owner
must separately establish working native Pi and repository credentials; readiness
reports missing prerequisites without offering a browser secret upload.

The pilot repeats Y1–Y5 first, then M1–M7 when their implementations exist. Use a
unique disposable workspace and Pi session per user, verify ordinary same-user
Git/`gh` commands from the daemon environment, and induce browser, SSE, gateway
and daemon failures. Remote GitHub create/delete remains separately authorized
as required by the workspace probe. Reset stops only pilot-owned processes,
removes pilot workspaces through their native owner (Taskfleet where applicable),
disables the two product sockets through Fleetrepo if abandoning the pilot, and
reapplies the prior Fleetrepo declaration. It never deletes users' ordinary
histories or credentials.

`review-implementation-plan` must approve: the Rust/dependency pins; OIDC
provider, redirect origin, immutable subject mappings and session limits;
systemd user/group/socket/unit bytes, explicit daemon environment and hardening;
gateway UID and peer-credential checks; Pi child/restart semantics; command-ID
and SSE retention contracts; release signing/checksum and immutable paths;
Fleetrepo account/unit/check/apply/rollback implementation; Tailscale Serve route;
disposable fixture; Alder test accounts, workspaces, reset list, health/smoke
commands and maintenance window. Until then,
all commands and topology details in this ADR are proposals.

## Consequences

Rust gives one memory-safe native artifact, direct Unix/process APIs, bounded
resource control and no production language runtime. The same code can expose
strict JSON and share contract types while systemd and Unix UIDs preserve the
actual authority split. Static assets and a loopback gateway keep the browser
same-origin. Socket activation makes an unavailable user daemon explicit and
keeps routing independent of a browser field.

The costs are a slower build and a larger engineering learning surface than
TypeScript, plus explicit OIDC/session work. A statically linked application is
still not dependency-free: security updates require rebuilding and replacing the
artifact. The daemon intentionally has its user's broad authority. systemd
hardening reduces accidental host access for the gateway but cannot sandbox an
agent from its own Unix account.

Active Pi computation survives browser and gateway loss, but not daemon death or
host reboot. That smaller ownership model is observable and recoverable. A
separate persistent runtime supervisor would add another protocol, owner and
upgrade boundary before evidence requires it.

## Assumptions requiring proof

1. Axum/Tokio can serve the final HTTP/SSE contract over both loopback TCP and
   socket-activated Unix listeners while preserving peer credentials and bounded
   backpressure.
2. The selected OIDC provider supplies stable issuer/subject values for both
   pilot identities, and the callback/session/CSRF implementation passes focused
   security tests.
3. systemd's concrete template expansion, socket owner/group/mode, service UID,
   `SO_PEERCRED` and hardening behave as designed for both Alder users.
4. Rust daemon memory, CPU and file-descriptor use remain acceptable with two
   users, representative long histories, SSE replay and concurrent Pi children.
5. Pi child shutdown on daemon failure settles native history safely enough for
   deliberate recovery and never creates a competing writer.
6. The gateway can be denied home access while reaching only configured sockets,
   OIDC, static assets and its service credentials.
7. Tailscale Serve provides the stable HTTPS origin and proxy behavior required
   by OIDC and SSE on the pilot.
8. The Fleetrepo release hook can verify, install, quiesce socket activation,
   update and roll back immutable artifacts idempotently without touching
   user-native state.

Failure of an assumption returns the affected choice to
`review-implementation-plan`; it must not be hidden with a weaker test or an
undocumented host mutation.

## Rejected alternatives

### Go for both processes

Go provides an excellent HTTP stack, simple concurrency and static Linux
artifacts. It could implement this design. It is not selected because Alder does
not currently have Go while Rust stable and musl are already fleet-managed, the
repository is prepared for Cargo, and Rust gives tighter compile-time ownership
and error handling around long-lived child processes, byte-stream framing and
Unix credentials. Adding a second fleet toolchain for a marginally smaller
source implementation is not the smallest deployed system. Reconsider only if
the Rust walking slice shows materially worse complexity or resource behavior.

### TypeScript/Node for gateway and daemon

Node 22.23.2 already exists on Alder and would share the browser language.
Nevertheless, ADR 0002 deliberately makes Node build-time only. A Node daemon
would add a production runtime and package tree, garbage-collected per-user
processes and more care around native peer credentials, process groups and
single-file rollback. Sharing TypeScript types does not justify sharing process
authority or deployment. It remains useful for the frontend build, not the host.

### Split languages or a Caddy/Node gateway plus Rust daemon

A split adds two build, logging, release and vulnerability paths without evidence
that either half needs a different runtime. Existing Tailscale supplies pilot
TLS forwarding, but it does not replace application OIDC, account mapping,
sessions, API routing or static-file policy. Keep those in the Rust gateway.

### Root gateway or setuid user switching

A root gateway could open every home and start processes after changing UID, but
a routing or parser error would then cross all user boundaries. A non-root fixed
gateway plus socket-activated per-user services has enough authority and no more.

### Shared TCP ports or bearer secrets between gateway and daemons

Loopback TCP does not carry a Unix UID and requires another secret lifecycle.
Per-user Unix sockets provide filesystem routing and `SO_PEERCRED`; adding shared
tokens would increase secret handling without strengthening the selected local
boundary.

### Containers for each user

Containers would duplicate native homes, credentials, tmux and Taskfleet
integration or require broad bind mounts that erase their apparent isolation.
ADR 0001 deliberately chooses Unix users. Use a disposable VM/container only as
a test fixture, not as product topology.

### A persistent Pi sidecar or internal process registry

A sidecar could preserve active turns across daemon upgrades, but it creates a
second daemon protocol and ownership source. An internal registry would conflict
with native discovery unless carefully disposable. The proposed direct-child
model is smaller and honest about restart limits. Add a supervisor only after a
measured requirement and a new reviewed decision.

## Evidence

The inspected revisions, upstream versions and licenses, disposable Unix-socket
probe, exact commands, outcomes and limitations are preserved in
[`../issues/choose-host-stack/result.md`](../issues/choose-host-stack/result.md).
The runnable probe is under
[`../issues/choose-host-stack/experiment/`](../issues/choose-host-stack/experiment/).
