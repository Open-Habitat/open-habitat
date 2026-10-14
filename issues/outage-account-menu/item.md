---
created: 2026-10-14
updated: 2026-10-14
type: improvement
reporter: jari
status: done
priority: normal
related: ['@sidebar-account-menu']
lane: web
lane_seq: 32
collision: [web/]
closed: 2026-10-14
closed_by: claude
---

# Account menu on pages without a workspace snapshot

Follow-up to `sidebar-account-menu` (Jari 2026-10-14). When the daemon is unavailable, or Pi onboarding prevents a snapshot, the sidebar is not mounted. With the inline link removed, an administrator then reaches administration only by typing `/administration`, which is exactly when it is needed most.

Show the same account button and menu (`AccountMenu` from `sidebar-account-menu`) on those pages without a workspace snapshot: name and email from the session, Asetukset, Palvelimen ylläpito for administrators (role from `/api/v1/server` as today), Teema, Kirjaudu ulos. If the role cannot be read, the entry is absent, and the host still authorizes.

## Acceptance Criteria

- [x] On the "Yhteyttä ei saatu" page and during Pi onboarding, the account button is visible. An administrator fixture sees Palvelimen ylläpito; a non-admin does not (browser tests).
- [x] No other link to administration is reintroduced.
- [x] result.md has a "Decisions for later review" section.
