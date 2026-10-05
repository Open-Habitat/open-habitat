---
created: 2026-10-04
updated: 2026-10-05
type: task
status: done
priority: normal
related: ['@rethink-project-docs', '@persist-browser-sign-in']
labels: [human-review]
lane: planning
preparation: reviewing
closed: 2026-10-05
closed_by: jari
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

## Decision

Agreed with Jari on 2026-10-05. He judged the change small enough not to need
an ADR.

The gateway keeps a persistent server-side session record and gives the
browser a persistent cookie holding only a random opaque secret. The record,
not the cookie, says who is signed in: a cookie with no valid record is denied,
whether the record expired, was removed by logout or operator revocation
([ADR 0006](../../docs/decisions/adr-0006-subject-revocation.md)), or the
store is missing or unreadable. Losing the store therefore means everyone
signs in again, never that an unverified cookie is trusted. Jari accepted
this consequence.

The records live in a directory owned by the gateway alone, outside the
replaceable release and `/run`, so they survive restarts and upgrades and no
other non-root account can read them. The gateway service has no such
directory today, so the deployment gains one. A single file rewritten
atomically is enough for the handful of sessions this host carries; a
database is not needed. Sessions do not go into the broker ledger or a
user's home, and no OAuth token or native credential goes into the record.

A session lasts months of ordinary use, not hours: an idle limit refreshed by
use, and an absolute limit so that a stolen cookie cannot live forever. The
exact numbers are proposed and settled in the implementing issue.

Authorization stays as decided in
[ADR 0004](../../docs/decisions/adr-0004-first-login-user-provisioning.md)
and ADR 0006: the broker is checked at sign-in and at revocation, not on
every request.

User removal, logout as a whole and access revocation are designed separately
later.

## Acceptance Criteria

- [x] Jari has agreed in this issue how sign-in is kept and how long it lasts.
- [x] The implementing work is filed as its own issue, so that afterwards a person is not asked to sign in again during ordinary use or after a gateway restart or upgrade.

## Resolution

### 2026-10-05T11:29:29Z · @jari

Decision agreed with Jari 2026-10-05; implementation is @persist-browser-sign-in.
