---
created: 2026-11-27
updated: 2026-11-27
type: task
reporter: conductor
status: testing
priority: normal
provenance: chat
source_ref: chat:conductor-2711/m365-setup-guide
lane: m365-tenants
lane_seq: 5
blocked_by: ['@m365-tenants-guest-mailbox-probe']
collision: [web/src/text/serverIntegrations.tsx]
preparation: ready
---

# Microsoft multi-tenant: browser setup guide creates the shared applications

## Description

Gap left by m365-tenants-ui (run 01m8ey3cepv83agzgax9y4gea3): the browser setup guide only creates single-tenant applications; the shared (multi-tenant, 'Accounts in any organizational directory') applications of direction B are set only with root's CLI. Extend the existing guided flow (design.md section 4: 'same guided flow as now, one step different') so the administrator can create or convert them from the browser. Part of the approved design.
