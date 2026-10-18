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
lane_seq: 4
collision: [internal/daemon/integrations]
blocked_by: ['@integrations-catalog-core']
---

# Integration: Microsoft (OneDrive/SharePoint sync, Outlook mail, calendar, contacts)

Microsoft entries: OneDrive and SharePoint continuous sync (abraunegg/onedrive, rclone fallback) into `~/cloud/onedrive/<account>/` and `~/cloud/sharepoint/<org>/<site>/<library>/`; Outlook mail, calendar and contacts through the pinned Softeria ms-365-mcp-server with device-code login; tenant admin consent shown plainly when required. Needs the operator's Entra application.

## Acceptance Criteria
- [ ] Connect, choose folders, use from an agent, consent-required state, remove; disposable-home tests and one live check.

Follows ADR 0026 (integrations catalog, accepted by Jari 2026-10-18) and the prototype `proto-integrations` (direction Tili; `design-system/prototypes/rounds/2026-10-18-integraatiot/`; feasibility findings and Jari's decisions in its `result.md`). Every tool runs as the person; tokens stay in the tool's own store in their home; nothing about connections is stored by the host.
