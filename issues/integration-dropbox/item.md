---
created: 2026-10-18
updated: 2026-10-20
type: feature
reporter: jari
status: done
priority: high
epic: agent-integrations
preparation: ready
lane: integrations
lane_seq: 1
collision: [internal/daemon/integrations]
blocked_by: ['@integrations-catalog-core']
closed: 2026-10-20
commits:
- hash: d59e507a1c83c08361b4ac3f141be8b24f7b7ecb
  summary: 'feat(integrations): connect and continuously sync dropbox as the person'
- hash: 210a4b05dce9d0c33ab1aa0f7d2323db29b13288
  summary: 'chore: format the synthetic claude model capture helper'
---

# Integration: Dropbox sync

Dropbox continuous two-way sync with rclone into `~/cloud/dropbox/<account>/`; the operator's Dropbox app.

## Acceptance Criteria
- [x] Connect, sync, remove; disposable-home tests.

Follows ADR 0026 (integrations catalog, accepted by Jari 2026-10-18) and the prototype `proto-integrations` (direction Tili; `design-system/prototypes/rounds/2026-10-18-integraatiot/`; feasibility findings and Jari's decisions in its `result.md`). Every tool runs as the person; tokens stay in the tool's own store in their home; nothing about connections is stored by the host.
