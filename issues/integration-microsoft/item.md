---
created: 2026-10-18
updated: 2026-10-25
type: feature
reporter: jari
status: done
priority: high
epic: agent-integrations
preparation: ready
lane: integrations
lane_seq: 3
collision: [internal/daemon/integrations]
blocked_by: ['@integrations-catalog-core']
closed: 2026-10-20
---

# Integration: Microsoft (OneDrive/SharePoint sync, Outlook mail, calendar, contacts)

Microsoft entries: OneDrive and SharePoint continuous sync (abraunegg/onedrive, rclone fallback) into `~/cloud/onedrive/<account>/` and `~/cloud/sharepoint/<org>/<site>/<library>/`; Outlook mail, calendar and contacts through the pinned Softeria ms-365-mcp-server with device-code login; tenant admin consent shown plainly when required. Needs the operator's Entra application.

## Acceptance Criteria
- [ ] Connect, choose folders, use from an agent, consent-required state, remove; disposable-home tests and one live check.

Follows ADR 0026 (integrations catalog, accepted by Jari 2026-10-18) and the prototype `proto-integrations` (direction Tili; `design-system/prototypes/rounds/2026-10-18-integraatiot/`; feasibility findings and Jari's decisions in its `result.md`). Every tool runs as the person; tokens stay in the tool's own store in their home; nothing about connections is stored by the host.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
