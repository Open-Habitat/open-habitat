---
created: 2026-10-05
updated: 2026-10-05
type: feature
reporter: jari
status: untriaged
priority: normal
originating_run_kind: spinoff
provenance: agent
provenance_detail: filed from design review with Jari
source_ref: taskfleet:01m45wen480zd1mr6544anf61c/implementation:design-durable-sign-in
originating_run: 01m45wen480zd1mr6544anf61c
related: ['@design-durable-sign-in']
---

# Keep browser sign-in across gateway restarts and upgrades

## Description

## Goal

A person is not asked to sign in again during ordinary use or after a gateway
restart or upgrade. The design is decided in @design-durable-sign-in; this
issue implements it.

## Decided (see @design-durable-sign-in)

- The gateway keeps a persistent server-side session record; the browser
  carries a persistent cookie holding only a random opaque secret.
- A cookie with no valid record is denied, including when the store is
  missing or unreadable. Losing the store means everyone signs in again.
- Records live in a directory owned by the gateway alone, outside the
  replaceable release and `/run`. A single file rewritten atomically is
  enough; no database.
- A session lasts months of ordinary use: an idle limit refreshed by use and
  an absolute limit. The exact numbers are proposed and settled here.
- The broker is checked at sign-in and at revocation, not on every request
  (ADR 0004, ADR 0006). Logout and operator revocation keep working.

## Implementation notes

Proposals to settle in this issue, with the reasoning recorded here:

- Lifetime numbers (the earlier proposal was 90 days idle, one year
  absolute). Renew the stored idle deadline on use at a bounded cadence rather
  than on every request; never extend the absolute deadline.
- Store the hash of the cookie secret, the broker-authorized GitHub ID and
  Unix route, Access email binding, CSRF secret and both deadlines. No OAuth
  token or native credential. Persist creation before the cookie is sent and
  deletion before logout or revocation is acknowledged; serialize lookup,
  renewal, logout and subject deletion so a concurrent request cannot restore
  a revoked session. Open and validate the file before serving authenticated
  traffic; purge expired records opportunistically.
- Cookie: `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/` as now, plus
  `Max-Age` ending at the absolute deadline. The server deadline is
  authoritative.
- Deployment: give the gateway unit a `StateDirectory` in `systemd/` and in
  Fleetrepo's test-server installation (`infra/native-agent-host-test/`).
  Sessions never go into the broker ledger or a user's home.
- Documentation: `docs/architecture/identity-and-trust.md`,
  `docs/architecture/deployment.md` and `docs/product.md` describe the old
  in-memory behaviour and are updated with the implementation.

## Acceptance Criteria

- [ ] A signed-in person stays signed in across a gateway restart and a release upgrade on the test server.
- [ ] Closing and reopening the browser within the idle limit does not require signing in again.
- [ ] Logout and operator revocation end web access as before; an expired or revoked cookie is denied.
- [ ] Chosen lifetime numbers and their reasoning are recorded in this issue, and the architecture and product docs describe the new behaviour.
