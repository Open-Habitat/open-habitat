---
created: 2026-10-05
updated: 2026-10-05
type: feature
reporter: jari
status: open
priority: normal
originating_run_kind: spinoff
provenance: agent
provenance_detail: filed from design review with Jari
source_ref: taskfleet:01m45wen480zd1mr6544anf61c/implementation:design-durable-sign-in
originating_run: 01m45wen480zd1mr6544anf61c
related: ['@design-durable-sign-in']
lane: gateway-session
collision: [internal/gateway/, docs/, systemd/native-agent-host-gateway.service]
preparation: ready
---

# Keep browser sign-in across gateway restarts and upgrades

## Purpose

A person stays signed in through ordinary use, browser closure, gateway
restarts and release upgrades. Reauthentication is for logout or a stale
session, not a daily routine. This issue implements the decision agreed with
Jari in @design-durable-sign-in.

## Agreed design

The gateway owns a persistent server-side session record; the browser carries
only a random opaque secret in a persistent cookie. The record is the authority:
an expired, revoked or unrecognised cookie grants no access, including when
the store is missing or unreadable. Jari accepted that losing the store means
everyone signs in again.

A single atomically rewritten file is enough for this host's handful of
sessions. It belongs in gateway-private state outside the replaceable release
and `/run`, so upgrades preserve it and other non-root accounts cannot read it.
The broker ledger and users' homes serve different authorities. Session state
contains no OAuth tokens or native credentials.

Sessions last months of ordinary use, with a renewable idle limit and a fixed
absolute limit that bounds the life of a stolen cookie. Choose and justify the
numbers here; 90 days idle and one year absolute is an earlier proposal, not
a settled requirement.

## What the implementation needs to preserve

Restored sessions retain the broker-authorized identity and Unix route, Access
email binding and CSRF protection. Store a hash of the browser secret rather
than the usable bearer secret. Existing cookie protections remain, with browser
persistence bounded by the absolute deadline; server-side expiry is authoritative.

Successful login means the session survives a restart. Successful logout or
operator revocation means it stays removed after a restart or a concurrent
request. This durability is what matters when choosing persistence, failure
handling and synchronization. Idle renewal should avoid a disk write on every
request without extending the absolute lifetime.

Authorization and revocation retain their existing scope in
[ADR 0004](../../docs/decisions/adr-0004-first-login-user-provisioning.md) and
[ADR 0006](../../docs/decisions/adr-0006-subject-revocation.md): the broker is
consulted at sign-in and revocation, not on every request. Broader account
removal and logout design belong elsewhere.

The deployment needs durable gateway state in both the `systemd/` templates
and Fleetrepo's `infra/native-agent-host-test/` installation. Update the current
behaviour documented in `docs/architecture/identity-and-trust.md`,
`docs/architecture/deployment.md` and `docs/product.md` with the implementation.

## Acceptance Criteria

- [ ] A signed-in person stays signed in across a gateway restart and a release upgrade on the test server.
- [ ] Closing and reopening the browser within the idle and absolute limits does not require signing in again.
- [ ] Logout and operator revocation retain their existing scope and remain effective after restart; expired or revoked cookies and cookies without a valid stored record grant no access.
- [ ] Chosen lifetime numbers and their reasoning are recorded in this issue, and the architecture and product docs describe the new behaviour.
