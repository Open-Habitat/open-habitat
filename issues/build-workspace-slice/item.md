---
created: 2026-09-20
updated: 2026-09-21
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 30
blocked_by: ['@build-design-system']
collision: [docs/, AGENTS.md, design-system/]
---

# Build login to workspace navigation

## Goal

Implement the first end-to-end browser path through the gateway and per-user daemon to the real workspace directory list.

## Context

Follow the current Unix-native architecture and the bounded UI v1 brief.

Sources: [architecture](../../docs/architecture.md),
[design package](../native-agent-host-architecture/ui-design-package.md),
[conversation v1](../native-agent-host-architecture/ui-design-conversation.md).
Detailed plans and results for this task belong in this issue directory.

## Scope

Keep native histories, component configuration and subprocess ownership with their
native components. Use the agreed HTTP/SSE path. Do not add a workspace registry,
parallel history store, credential broker, internal tenant model or speculative cache.

## Acceptance Criteria

- [ ] Exercise two distinct mapped test identities and reject unknown mappings, cross-user daemon routing and path escapes from this first authenticated slice; final verification expands these checks.
- [ ] Use the real gateway/daemon path and reusable production navigation components, not a separately implemented mock UI.

- [ ] Use the implementation choices and test commands established by @plan-v1-implementation.
- [ ] Authenticate a web identity, map it to one fixed Unix user and route to that user's daemon.
- [ ] List immediate ~/src directories including non-Git directories and directories without workspace metadata.
- [ ] Implement the accepted navigation and loading/empty/error views with no workspace registry or separate harness settings.
- [ ] Demonstrate the real end-to-end path and automated checks appropriate to routing and directory access.

## Implementation and evidence

Use the [delivery plan](../plan-v1-implementation/plan.md), accepted implementation
briefs and exact checks verified by @build-app-foundation. Save `result.md` here with
the tested revision, commands, outcomes and remaining limits. Update the affected
durable documents and component examples; do not duplicate task state in TODO.md.

## Bounded planning handoff

This issue owns Y1 and the discovery/Git-gate portion of Y2. Use the two synthetic identities/UIDs and real gateway→systemd socket→daemon route; test OIDC state/nonce/PKCE/session/CSRF/origin, immutable subject mapping, wrong peer/socket/header, gateway home denial, symlink/path escape and credential/log absence. Stop before history or lifecycle writes. Exact CT IDs, commands and evidence are in [the implementation briefs](../plan-v1-implementation/implementation-briefs.md).
