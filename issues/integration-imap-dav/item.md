---
created: 2026-10-18
updated: 2026-11-14
type: feature
reporter: jari
status: done
priority: high
closed: 2026-10-21
preparation: ready
lane: integrations
lane_seq: 4
collision: [internal/daemon/integrations]
---

# Integration: IMAP/SMTP mail and CalDAV/CardDAV

Generic mail via himalaya and calendars/contacts via CalDAV/CardDAV with app passwords (iki.fi, Nextcloud and similar), several accounts, no OAuth registration. If the catalog core already shipped IMAP as its first entry, this adds SMTP drafts/sending rules and CalDAV/CardDAV.

## Acceptance Criteria
- [x] Connect, use from an agent, remove; disposable-home tests against a local IMAP/DAV fake.

Follows ADR 0026 (integrations catalog, accepted by Jari 2026-10-18) and the prototype `proto-integrations` (direction Tili; `design-system/prototypes/rounds/2026-10-18-integraatiot/`; feasibility findings and Jari's decisions in its `result.md`). Every tool runs as the person; tokens stay in the tool's own store in their home; nothing about connections is stored by the host.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
