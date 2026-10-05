---
created: 2026-10-04
updated: 2026-10-05
type: task
status: open
priority: normal
related: ['@rethink-project-docs']
labels: [human-review]
lane: planning
preparation: ready
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

User removal, logout as a whole and access revocation are designed separately
later.

## Acceptance Criteria

- [ ] Jari has agreed in this issue how sign-in is kept and how long it lasts.
- [ ] The implementing work is filed as its own issue, so that afterwards a person is not asked to sign in again during ordinary use or after a gateway restart or upgrade.
