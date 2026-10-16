---
created: 2026-10-16
updated: 2026-10-16
type: feature
reporter: jari
status: open
priority: normal
lane: auth
collision: [internal/gateway, web/src/app/]
preparation: ready
---

# Implement phone sign-in by QR (ADR 0018)

Implement [ADR 0018](../../docs/decisions/adr-0018-phone-sign-in-by-qr.md), accepted by Jari 2026-10-16 (direction A: QR from the desktop; showing the code needs no new GitHub sign-in). First change the ADR's status to Accepted with that date. Scope per the ADR's Consequences: gateway link-token routes and session metadata, the recent-sign-in check fix (a QR-made session must not pass the `gh` detach "signed in within 5 min" check), Settings QR and session list with sign-out, the `/link` page, and the listed tests. All sessions sign in once again after the session format change.

## Acceptance Criteria
- [ ] ADR 0018 Accepted; gateway tests for expiry, single use, revocation and the recent-sign-in fix; browser test of the phone flow.
