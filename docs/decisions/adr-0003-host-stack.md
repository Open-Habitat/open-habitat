# ADR 0003: Use one Go host binary, systemd services and Unix sockets

**Status:** Accepted

**Decision date:** 2026-09-23

**Original acceptance:** 2026-09-23 at artifact revision `b87b1aae5d6fefcd914d4f06c0e510b5ca124f60`

**Authors:** Pi (original); Codex (revision)

**Revised:** 2026-09-29; based on Jari's agreed rewrite scope, OAuth/OIDC library-choice clarification and editorial corrections. The original acceptance identifies the earlier wording.

## Context

A person reaches their native workspaces and Pi conversations through a browser.
Their agents must keep working when the browser closes, and one person's login
must never grant access to another person's files or processes. The host needs
clear Linux process and account boundaries that are straightforward to inspect,
test and operate.

## Decision

### One codebase, separate authorities

Ship one statically linked Go host binary with separately run gateway and
per-user daemon roles. Shared code keeps protocol handling, diagnostics and
release provenance together; separate Unix accounts keep their authority apart.

The gateway runs under a fixed non-root UID, authenticates the browser and
routes requests. It cannot read user homes or run their agents. Each daemon
runs as its mapped Unix user and performs that user's native work.
A separate root-only broker creates and verifies the account and binding on
first approved login, as defined in
[ADR 0004](adr-0004-first-login-user-provisioning.md).

Go's standard HTTP, process and Unix support, fast builds and concurrency tests
make this service easier to maintain. The Rust probe established feasibility,
but its added ownership complexity did not improve the chosen boundary.
A Node host would add a JavaScript dependency tree to the host itself. The
frontend is shipped as static assets; native Pi still needs its own
[Node runtime](../architecture/identity-and-trust.md). Toolchain pins belong in the build configuration.
OAuth/OIDC library choice is implementation judgment; the authentication behavior
and security properties must be verified whichever implementation is used.

### Authenticated routing and native GitHub credentials

Use HTTP over systemd-created per-user Unix sockets. The gateway verifies that
it reaches the mapped user's daemon, and the daemon authenticates the gateway.
Browser-supplied identity or routing fields cannot select another user's account.

One GitHub authorization establishes web identity from the stable numeric
GitHub ID and installs native `gh` HTTPS credentials under the mapped UID.
The gateway holds the callback token transiently and forwards it once over the
authenticated local route. It never persists it, logs it or returns it to the
browser. The daemon independently verifies identity, Git helper behavior and
the actual credential-storage location. Keyring and protected-file storage must
be reported honestly; unsafe or unknown storage cannot complete login.
The broad scopes needed by native `gh` do not authorize arbitrary repository
mutations by the product.

A partial or uncertain native installation does not create a normal web session.
A later login reobserves native state rather than replaying a retained token.
Web sessions and writes are protected by authenticated cookies, exact-origin
checks and session-bound CSRF. Web logout ends web access while leaving native
Git credentials available. Explicit native disconnect removes local credentials;
provider-token revocation is a separate action. Optional Google login establishes
web identity only and makes no request before explicit user selection.

Exact authentication, storage and routing requirements are in
[interfaces](../architecture/identity-and-trust.md).

### Native work belongs to the user's daemon

The daemon starts Pi RPC directly as its child in the user's workspace. Pi owns
tool execution, configuration and history; Taskfleet owns its worktree lifecycle.
Browser conversations have one writer. Terminal histories are read-only, and
independent clients are not used to control the same conversation simultaneously.

Browser or gateway loss leaves Pi running. SSE lets the browser recover an
up-to-date view without silent gaps. Daemon stop or crash invokes systemd service
cleanup; it does not promise survival of an active turn. An individually detached
tool may outlive interruption, and work outside the service cannot be claimed
stopped without native evidence. Show unresolved sends and termination as
uncertain, never retry them automatically, and never start another writer into
unresolved work.

After restart, native history remains the source. An ended browser conversation
can be deliberately continued once its previous work is known to have ended.
This does not require a per-conversation cgroup or a second persistent supervisor;
stronger containment needs a concrete reason and a separate decision.
[Agent control](../../issues/build-agent-control/item.md) owns the implementation.

### Restricted services and recoverable releases

Systemd runs the gateway without home access and each daemon with only its user's
authority. Service restrictions, environment setup and authenticated socket paths
enforce that separation. Public health is aggregate; detailed readiness is
restricted. Logs exclude credentials and user content. The
[service and diagnostic requirements](../architecture/deployment.md)
preserve the detailed protections; the operator CLI follows the
[AI-first canon](../../CONFORMANCE.md).

Ship the binary, static frontend and neutral service templates as a
checksum-verified immutable release. Activation selects it atomically and keeps
a known-good predecessor for rollback. Native histories, credentials and user
settings remain outside the release. The product owns portable packaging and
generic self-hosting guidance; Fleetrepo owns the concrete test installation,
secrets, ingress and deployment receipts.
[Installation and recovery](../../issues/installation-and-operations-guide/item.md) owns the
procedures and their verification.

## Consequences and evidence

The deployment has one host artifact without combining users' authority.
Native work survives browser loss, while daemon failure requires honest
reconciliation against native history. GitHub scope breadth and credential
storage remain visible trade-offs.

The [Go experiment and original review evidence](../../issues/apply-review-corrections/result.md)
support the stack choice. Cross-user denial, authenticated credential handoff,
native process behavior and release recovery must be demonstrated by the
implementing issues. Synthetic, systemd-guest and live-host evidence have
different reach; this decision is not a claim that every requirement is implemented.
