---
created: 2026-10-24
updated: 2026-10-24
type: feature
status: done
priority: normal
preparation: ready
lane: unlaned
collision: [internal/provision, internal/hostop]
closed: 2026-10-24
closed_by: claude
---

# Installations without a separate quota-enabled /home

## Description

Jari, 2026-10-24: `docs/operations.md` requires a separately mounted ext4 `/home` with enforced internal user quotas; birch (Fleetrepo) has one root disk. "Typerä rajoitus. Kyllä tämä malli pitäisi toimia." Decision: an installation must work on an ordinary single-filesystem Ubuntu server.

Goal: `host prepare|plan|apply` support installations where `/home` is on the root filesystem and per-user quotas are not available: storage quotas become an optional capability the site declares (e.g. site.json storage mode), the broker and the UI work without them (no quota enforcement, quota UI shows that limits are not in use rather than failing), and everything that assumed the quota filesystem (first-login quota setup, quota-full experience, storage checks, the release storage gate) degrades explicitly. Keep the quota mode fully working where it is configured. Update `docs/operations.md` and `internal/AGENTS.md` (state what an installation without quotas does not protect against: one person filling the disk).

## Acceptance Criteria

- [x] Prepare/plan/apply and first login on a single-filesystem host without quotas (VM scenario or distinct-UID container), and the quota mode unchanged (existing tests). Prepare, check, broker first login and cold boot proven by `host-shared-home`; apply itself not run, see result.md.
- [x] Review: independent `/llm-review` (broker account setup, storage authority).

## Resolution

### 2026-10-24T13:10:40Z · @claude

Sites can declare storage.enforce_user_quota false; prepare, boot gate, broker, gateway, daemon and UI work without quotas; quota mode unchanged. host-shared-home VM and full gate pass; apply in this mode not yet run (birch install).
