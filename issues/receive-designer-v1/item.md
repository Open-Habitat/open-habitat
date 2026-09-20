---
created: 2026-09-20
updated: 2026-09-20
type: task
status: in-progress
priority: normal
epic: native-agent-host-architecture
labels: [external-input]
---

# Receive the external designer UI v1 artifacts

## Goal

Collect the designer output that Jari is commissioning, without starting a duplicate design worker.

## Context

On 2026-09-20 Jari said he is putting the designer to work. No output has been received yet. This is external work coordinated by the user, deliberately without an executable lane. Do not automatically assign another agent, contact the designer, or mark this complete based on elapsed time. Handoff files are native-agent-host-ui-01-workspaces.zip and native-agent-host-ui-02-conversation.zip in Rowan Downloads.

Sources: [architecture](../../docs/site/architecture.md),
[design package](../native-agent-host-architecture/ui-design-package.md),
[conversation v1](../native-agent-host-architecture/ui-design-conversation.md).
Detailed plans and results for this task belong in this issue directory.

## Scope

Keep native histories, component configuration and subprocess ownership with their
native components. Use the agreed HTTP/SSE path. Do not add a workspace registry,
parallel history store, credential broker, internal tenant model or speculative cache.

## Acceptance Criteria

- [ ] Record stable artifact links or place received files under this issue directory, with the brief revision they implement.
- [ ] Collect the conversation first-draft direction and record Jari's feedback before treating the full design as accepted.
- [ ] Collect the v1 conversation states and the surrounding host/workspace views, including desktop/mobile and any missing states.
- [ ] Mark delivery complete when artifacts are available for the separate review issue; delivery alone is not design acceptance.
