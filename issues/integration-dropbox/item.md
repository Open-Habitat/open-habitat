---
created: 2026-10-18
updated: 2026-10-20
type: feature
reporter: jari
status: open
priority: high
epic: agent-integrations
preparation: ready
lane: integrations
lane_seq: 1
collision: [internal/daemon/integrations]
blocked_by: ['@integrations-catalog-core']
---

# Integration: Dropbox sync

Dropbox continuous two-way sync with rclone into `~/cloud/dropbox/<account>/`; the operator's Dropbox app.

## Acceptance Criteria
- [ ] Connect, sync, remove; disposable-home tests.

Follows ADR 0026 (integrations catalog, accepted by Jari 2026-10-18) and the prototype `proto-integrations` (direction Tili; `design-system/prototypes/rounds/2026-10-18-integraatiot/`; feasibility findings and Jari's decisions in its `result.md`). Every tool runs as the person; tokens stay in the tool's own store in their home; nothing about connections is stored by the host.
