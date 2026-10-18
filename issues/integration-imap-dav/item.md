---
created: 2026-10-18
updated: 2026-10-18
type: feature
reporter: jari
status: open
priority: high
epic: agent-integrations
preparation: ready
lane: integrations
lane_seq: 5
collision: [internal/daemon/integrations]
blocked_by: ['@integrations-catalog-core']
---

# Integration: IMAP/SMTP mail and CalDAV/CardDAV

Generic mail via himalaya and calendars/contacts via CalDAV/CardDAV with app passwords (iki.fi, Nextcloud and similar), several accounts, no OAuth registration. If the catalog core already shipped IMAP as its first entry, this adds SMTP drafts/sending rules and CalDAV/CardDAV.

## Acceptance Criteria
- [ ] Connect, use from an agent, remove; disposable-home tests against a local IMAP/DAV fake.

Follows ADR 0026 (integrations catalog, accepted by Jari 2026-10-18) and the prototype `proto-integrations` (direction Tili; `design-system/prototypes/rounds/2026-10-18-integraatiot/`; feasibility findings and Jari's decisions in its `result.md`). Every tool runs as the person; tokens stay in the tool's own store in their home; nothing about connections is stored by the host.
