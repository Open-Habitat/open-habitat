---
created: 2026-09-20
updated: 2026-09-21
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: ui-v1
lane_seq: 20
blocked_by: ['@review-ui-v1', '@probe-pi-control']
commits:
- hash: f2c326d23549333032af795b61b163b97040f854
  summary: 'docs(ui): schedule the accepted MVP capabilities'
---

# Specify the first implementation slices from the design and Pi probe

## Goal

Turn accepted UI v1 and observed Pi capabilities into small implementation briefs before writing the product.

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

- [ ] Choose the minimal implementation stack, gateway authentication method, daemon transport and packaging; justify choices briefly.
- [ ] Specify snapshot/command/SSE behavior, event identity, send acknowledgement, resume ownership and reconnect/resnapshot semantics.
- [ ] Try the selected renderer library with representative Pi tool/history events before committing to a runtime; verify copied-code licenses.
- [ ] Update the downstream workspace, history, control, local workspace lifecycle, GitHub, worktree, archive and resilience issues with exact boundaries and proportionate verification commands.
- [ ] Document product test/build commands and deployment target/procedure when actually selected; do not invent a working deployment.
- [ ] Record user-visible deviations from the accepted design for discussion before implementation.
