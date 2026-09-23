# ADR 0003: Use one Go host binary, systemd services and Unix sockets

**Status:** Proposed

**Date:** 2026-09-23

**Authors:** Pi, for review by Jari Mustonen

## Context

ADR 0001 requires an authenticated gateway and one daemon under each supported
Linux user's UID. The gateway must not read user homes. Daemons must use native
Pi history, Git, `gh`, tmux and Taskfleet under the mapped Unix identity. Browser
state uses JSON/HTTP and one cursor-based SSE stream. Closing the browser or
restarting the gateway must not stop Pi; daemon or host loss does stop active
computation, while settled native history remains resumable after writer-exit
and history-settlement proof.

The implementation should be easy to inspect and change at the Linux process,
socket and HTTP boundary. Current packages on Alder are not a language-selection
criterion: persistent build and runtime prerequisites are established later by
reviewed release and Fleetrepo contracts.

## Decision

### One Go codebase and binary

Subject to `review-implementation-plan`, implement gateway and daemon in one Go
module and ship one statically linked `native-agent-host` binary. Pin Go 1.27.1
for the first scaffold. It was the stable release reported by `go.dev/VERSION`
on 2026-09-23; its official Linux amd64 archive SHA-256 is
`63d339f0da5ab53635a56f2490a7984dfe12dfcff22ad749f63edaf590168445`.
Commit `go.mod` and `go.sum`; dependency updates rerun the complete gate.

Use the standard `net/http`, `net`, `os/exec`, `syscall`/`x/sys/unix` and
`log/slog` boundaries wherever they suffice. Add a small reviewed OIDC/OAuth
library rather than implementing protocol validation by hand. One codebase keeps
wire types, redaction, process ownership and release provenance together; two
runtime roles still run with different UIDs and authority.

Go is selected over Rust because this service is dominated by HTTP, OAuth,
JSON, Unix sockets and supervised child processes, where Go's standard library,
small explicit interfaces, fast builds and race-tested concurrency make review
and maintenance simpler. A disposable Go 1.27.1 slice built a CGO-free static
binary and repeatedly tested `SO_PEERCRED`, mode-0660 Unix sockets and direct
child/process-group shutdown. This technical and developer-feedback fit outweighs
whether Go happens to be installed on today's target. The earlier Rust slice in
`issues/choose-host-stack/result.md` remains truthful historical evidence, not
the current product recommendation.

The React client is built separately and its immutable `web/dist/` accompanies
the binary. Node is build-time only. The gateway returns `index.html` only for
known UI routes, never for API, event, auth or health paths.

### One GitHub authorization, two outcomes

The primary Alder login is **Sign in with GitHub**. One GitHub OAuth App
Authorization Code grant does both of the following after one consent:

1. establishes web identity from the authenticated `GET /user` response, keyed
   by GitHub's stable numeric user `id`, never login or email; and
2. configures the mapped Unix user's native GitHub CLI HTTPS credential path.

The authorization request uses exact configured callback URI, unpredictable
single-use `state`, and PKCE S256 (`code_challenge` and callback-held
`code_verifier`). The gateway validates state before exchanging the code and
validates the returned account against a root-owned mapping from
`(provider=github, numeric_id)` to one existing Unix user. Request the minimum
classic OAuth scopes required by the supported `gh auth login --with-token`
path: `repo`, `read:org`, and `gist`. These broad GitHub scopes are the current
GitHub CLI token contract, not product authorization to mutate arbitrary repos;
product operations remain target- and confirmation-scoped. No email scope is
needed for routing.

The callback token exists in gateway memory only long enough to call `/user` and
forward it once over the already authenticated mapped-user UDS connection. The
handoff also carries the exact numeric GitHub ID just returned by `/user`. It is
never logged, persisted by the gateway, placed in a cookie, returned to the
browser, put in argv/environment, or retried from a queue. The daemon accepts the
one-time handoff only on that callback-bound local request from the verified
gateway peer and only when its own root-owned user mapping names the same provider
and numeric GitHub ID. It consumes the token on stdin to:

```sh
gh auth login --hostname github.com --with-token --git-protocol https
gh auth setup-git --hostname github.com
```

and then zeroes/discards its transient buffer. It verifies `gh auth status`, the
reported numeric identity through `gh api user`, HTTPS protocol and an ordinary
credential-helper probe without printing the token. The observed ID must equal
both the handoff ID and daemon's root-owned mapped ID; mismatch triggers immediate
local `gh auth logout`, a partial result and no normal web session. The daemon must
detect and report where `gh` stored authentication. A system credential store is preferred;
a user-owned, mode-0600 regular `gh` config below a mode-0700 config directory is
a visible protected-file fallback for a headless host. Symlinks, group/world
readability, an unknown location or `--insecure-storage` are rejected. Never
claim OS-keyring storage when `gh` used its documented plaintext fallback.

Login is partial until both web session creation and native installation are
observed. If identity succeeds but native installation fails, create no normal
product session: show a correlation-safe recovery page and allow a new complete
authorization; do not retain the token. If native installation succeeds but the
response is lost, the next login reobserves the exact GitHub numeric identity and
native `gh` state before deciding whether another install is needed.

An optional configured Google OIDC provider may establish web identity only. It
makes no discovery or network request before explicit user selection and does
not configure GitHub credentials. Provider choice is explicit on the login page;
there is no automatic Google request or fallback. Google mapping uses exact
issuer and subject.

The opaque server-side web session uses a rotated
`__Host-agent-host; Secure; HttpOnly; SameSite=Lax; Path=/` cookie, 8-hour idle
and 24-hour absolute limits. Writes require exact same-origin `Origin` and a
session-bound CSRF header. Web logout invalidates only the web session and closes
its SSE connections; native `gh` continuity intentionally remains for agents and
ordinary Git. A separate explicit **Disconnect GitHub from this Unix account**
action explains that effect, requires fresh authentication and confirmation,
runs non-interactively as the mapped user:

```sh
gh auth logout --hostname github.com --user <verified-login>
```

then verifies auth absence and reports the still-installed Git helper as inert.
GitHub CLI documents that logout removes local authentication but does not revoke
the OAuth token; where revocation is required, the UI links to GitHub's authorized
application settings and says so rather than claiming revocation. Partial logout
or helper cleanup is shown as partial, never success.

### Gateway-to-daemon routing

Use HTTP/1.1 over one systemd-created Unix socket per configured user, mode 0660,
owned by that user and the fixed gateway group. The gateway selects the path only
from the immutable identity mapping. Daemons run as the real user and accept only
the fixed gateway UID from Linux `SO_PEERCRED`; they also verify configured user,
UID, home, socket instance and the root-owned provider/numeric-account mapping used
for credential handoff. Browser usernames, headers and socket hints are
ignored. No reusable local bearer token is added.

The fixed non-root gateway account has no home access or human supplementary
groups. Apply `NoNewPrivileges`, empty capabilities, `ProtectSystem=strict`,
`ProtectHome=yes`, private devices/temp, restricted address families, namespace
and kernel protections, and `UMask=0077`. It can access only release assets,
root-owned non-secret config, systemd credentials, its runtime directory, the
configured sockets and outbound GitHub/optional-Google HTTPS/DNS.

Daemon template services use `User=%i`, `Group=%i`, no capability or setuid path,
`KillMode=mixed`, `Restart=on-failure`, `ProtectSystem=full` and
`ProtectHome=no`. Set `HOME`, `USER`, `LOGNAME`, `XDG_RUNTIME_DIR` and an explicit
PATH. A mode-0600 user environment file may supply stable native-tool variables;
never source shell text. Only configured socket instances are enabled.

### Direct Pi child ownership

The daemon starts Pi RPC directly under its UID and workspace cwd, consumes
strict JSONL, and stores no parallel history. It owns an in-memory controller and
a mode-0700 runtime advisory lock for each `pi:<sessionId>`. Before writes it
reobserves Pi history, direct child/cgroup ownership, `/proc`, tmux and Taskfleet.
Unknown fails closed. A terminal TUI remains history-only until a known owner or
the user stops it and process exit plus history settlement are proved.

Browser and gateway loss leave the daemon and Pi child running. On graceful
daemon stop, reject new writes, ask owned Pi children to abort/settle, signal the
direct process group, wait a bounded period, and let systemd kill leftovers.
Daemon crash or host loss stops active computation. On restart, rediscover native
history and offer deliberate resume only after old-writer absence and settlement.
Do not add a persistent sidecar supervisor without a new measured decision.
Taskfleet alone creates and tears down its worktrees.

### AI-first operator CLI and diagnostics

The Go binary follows AI-first CLI canon v4. Inputs are strict; operation is
non-interactive and never TTY-shaped. The global `--json` works everywhere;
structured stdout and stderr envelopes carry schema versions; `--verbose` adds
redacted JSONL diagnostics to stderr. Errors use actionable/system exit 1/2 and
signals 130/143. Config and data roots report their source; mutation dry-runs are
truthful or return `dry_run_unsupported`; long work uses JSONL events.

Initial public surface:

```text
native-agent-host version --json
native-agent-host config path --component gateway|daemon --json
native-agent-host config show --component gateway|daemon --json
native-agent-host doctor --component gateway|daemon --json
native-agent-host gateway exec --config <path> --verbose
native-agent-host daemon exec --config <path> --verbose
native-agent-host admin readiness show --json
native-agent-host maintenance enter --idempotency-key <key> --dry-run --json
native-agent-host maintenance leave --idempotency-key <key> --dry-run --json
native-agent-host skill list --json
native-agent-host skill print operator --json
native-agent-host skill install operator --agent claude|pi|codex|all --dry-run
```

`gateway exec` and `daemon exec` are systemd entry points. Version output has
real build provenance or explicit null plus provenance object, never `unknown`.
Public `/healthz` and `/readyz` are aggregate only. Detailed readiness uses a
mode-0660 admin UDS. Logs exclude cookies, OAuth codes/tokens, CSRF, prompts,
responses, tool payloads, file content, full argv and native credential metadata.

### Packaging and ownership

CI emits a checksum-verified CGO-free Linux amd64 binary plus frontend assets,
service/socket templates, sysusers/tmpfiles declarations, defaults, licenses and
manifest. Immutable releases live below `/opt/native-agent-host/releases/`, with
an atomic `current` selector and one known-good predecessor. Mutable host mapping
and provider configuration live under `/etc/native-agent-host`; user annotation
and native credentials remain under the user.

Native Agent Host owns generic installation, configuration, test-environment,
update, rollback, live-version, diagnostics and operator documentation for any
self-hosted deployment. Fleetrepo owns only Jari's concrete Alder users, packages,
release pin, units/sockets, mappings, encrypted provider input, Tailscale route
and convergence. During MVP, `prepare-mvp-operations` coordinates a separate
reviewed Fleetrepo issue/worktree and records its commit and checks; this repo
never edits Fleetrepo as a hidden side effect.

When 0.1 is ready to publish, the conductor must file (not before then) a repo
issue to remove Alder-specific references from Git HEAD while retaining generic
self-hosting guidance and issue-local historical evidence.

### Verification boundary

Before Alder, a disposable systemd VM proves two synthetic UIDs, cross-user
denials, real socket activation/peer credentials, gateway home denial, OAuth
fixtures, direct-child restart behavior, SSE/ledger limits, update and rollback.
GitHub behavior uses deterministic fixtures plus **one** authorized private
disposable-repository smoke during the GitHub feature acceptance: create, exact
origin, ordinary HTTPS push, clone/pull and verified delete, with screenshots.
There is no separate broad two-user GitHub permission campaign. GitHub and `gh`
own ordinary permission semantics; the product proves safe targets, correct Unix
identity, staged truth and token secrecy. Cross-user security tests remain
mandatory and credential-free.

## Consequences

The result is one fast-building static host artifact with an explicit
least-privilege split and direct child ownership. Go's GC and runtime must be
measured under long histories and concurrent agents. OAuth scope breadth and
headless `gh` storage must be shown honestly. Active turns survive browser and
gateway loss, not daemon or host loss.

## Rejected alternatives

- **Rust gateway and daemon:** the previous probe proved feasibility, but Rust's
  ownership complexity and slower feedback do not improve this service's
  reviewed boundary enough to justify it. Its historical evidence is retained.
- **Node host:** shares frontend syntax but adds a production JS runtime/package
  tree and a less direct Unix/process edge.
- **Split languages/root gateway/shared TCP tokens/containers/persistent Pi
  sidecar:** each adds authority, release or protocol boundaries without an
  accepted requirement.

## Evidence and remaining proof

The corrected evidence, primary links, exact commands and disposable Go slice
are in [`../issues/apply-review-corrections/result.md`](../issues/apply-review-corrections/result.md).
Implementation must still prove real GitHub OAuth/PKCE behavior, actual supported
`gh` version/storage on the target, two-UID systemd routing, production
backpressure, Pi shutdown settlement, release lifecycle and Alder pilot. This ADR
remains Proposed until Jari records acceptance in `review-implementation-plan`.
