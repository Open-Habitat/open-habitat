---
created: 2026-10-04
updated: 2026-10-05
type: task
status: open
priority: normal
related: ['@rethink-project-docs']
labels: [human-review]
lane: planning
preparation: reviewing
---

# Design durable browser sign-in

## Problem

Jari reviewed `docs/architecture/identity-and-trust.md` on 2026-10-04 and
rejected what it described: being asked to sign in again daily, and losing the
session whenever the gateway restarts. That is not the experience he wants.

Today the gateway keeps sessions in memory, expires them after eight idle
hours or 24 hours in total, and sets a cookie that lasts only for the browser
session. That is a description of the current implementation in
`internal/gateway`, not an accepted product goal.

## Goal

A person stays signed in through ordinary use and across gateway restarts and
upgrades. Signing in again is for logout or a stale session, not a routine.

## Design

Agree with Jari how the gateway keeps sign-in across restarts and how long it
lasts, with the reasons behind the storage and lifetime choices. Existing
logout and the operator's session revocation ([ADR 0006](../../docs/decisions/adr-0006-subject-revocation.md))
keep working with whatever is chosen.

The agreed design is recorded in this issue. Jari judged on 2026-10-05 that
the change is small enough not to need an ADR.

### Proposal for joint review — not yet agreed

Keep the gateway as the sole owner of web sessions. Store them in a small local
SQLite database in a persistent gateway-only state directory outside the
replaceable release and `/run` (for example `/var/lib/native-agent-host/gateway`),
owned by the gateway UID and inaccessible to other non-root accounts. Give the
systemd gateway service write access to that directory; do not put sessions in
the broker ledger or a user's home. The browser still carries only the random
opaque `__Host-agent-host` secret. Index by its hash on disk rather than storing
the bearer secret; retain the broker-authorized GitHub ID and validated Unix
route, Access email binding, CSRF secret and expiry timestamps in the protected
record. No OAuth token or native credentials go into it. On restart, open and
validate the store before serving authenticated traffic; if it is unavailable
or corrupt, deny access rather than treating an unverified cookie as identity.

Set the cookie `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/` as now, but add a
persistent `Max-Age` ending at the server's proposed **one-year absolute
expiry**. Propose a **90-day inactivity expiry** refreshed on use, capped by
that absolute expiry. A person returning within that window survives browser
closure, gateway restarts and upgrades; a stolen cookie cannot live forever.
The server expiry, not the cookie, is authoritative. Refresh the stored idle
deadline on activity (a bounded interval such as once a day avoids writing on
every request), never extend the absolute deadline, and refuse authentication
when storage or a required renewal fails. An expired record is denied even if
the browser still sends its cookie; purge expired records opportunistically.

Persist creation before sending the cookie, and persist deletion before
acknowledging logout or operator revocation. Treat lookup, renewal, logout and
subject deletion as serialized transactions so a concurrent request cannot
restore a revoked session. Subject revocation continues to verify the binding
through the broker first and deletes only that subject's sessions; the
in-memory OAuth-flow cutoff stays sufficient across restart because pending
flows also disappear on restart. Do not recheck the broker for every request:
that would change the authorization contract in [ADR 0004](../../docs/decisions/adr-0004-first-login-user-provisioning.md)
and [ADR 0006](../../docs/decisions/adr-0006-subject-revocation.md).

**Review with Jari:** approve or adjust the 90-day idle / one-year maximum
trade-off, local gateway-owned SQLite storage, and the consequence that
explicit logout or revocation ends web access but loss of the protected store
requires everyone to sign in again. These are recommendations, not decisions;
leave both acceptance boxes unchecked until the review and later filing of
implementation work.

Source basis: `internal/gateway/auth.go` creates a random session secret and
CSRF value after the broker's final authorization check, then stores an
8-hour idle / 24-hour absolute record in a map and issues a session cookie
without `Max-Age`. `internal/gateway/session.go` renews idle time under the
same lock and deletes on logout; `internal/gateway/revoke.go` removes one
subject's records under that lock. `docs/architecture/identity-and-trust.md`
describes the current behavior, not the intended lifetime;
`docs/architecture/deployment.md` confirms that the present state does not
survive upgrades. The proposed database introduces a durable gateway-owned
store; it is not a new source of Unix identity or native agent state.

User removal, logout as a whole and access revocation are designed separately
later.

## Acceptance Criteria

- [ ] Jari has agreed in this issue how sign-in is kept and how long it lasts.
- [ ] The implementing work is filed as its own issue, so that afterwards a person is not asked to sign in again during ordinary use or after a gateway restart or upgrade.
