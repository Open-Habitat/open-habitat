---
created: 2026-09-20
updated: 2026-09-21
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: probes
lane_seq: 10
blocked_by: ['@finalize-design-docs']
---

# Verify native Pi discovery and browser control

## Goal

Run a small source-grounded and disposable technical probe of the Pi features needed by UI v1, independently of visual design.

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

- [ ] Record inspected Pi/extension versions and actual supported control interfaces.
- [ ] Demonstrate native history discovery, workspace association, resume, prompt, streaming tool events and interruption on a test conversation.
- [ ] Separate history discovery, live-process detection and actual controllability; verify or explicitly bound terminal-started agent attachment.
- [ ] Check stable event/tool IDs, intermediate output, diff availability and user-question response support without inventing missing APIs.
- [ ] Save a minimal reproducible probe and redacted event examples under this issue; report unsupported capabilities and adjustments for v1.
- [ ] Preserve the real user's sessions; do not build the production daemon, UI runtime or process registry in this probe.

## Output ownership

Write `result.md`, redacted events and reproducible disposable probes only in this issue directory. @prepare-ui-review integrates the evidence into docs/assumptions.md and the user journeys; do not edit shared docs, root instructions or the epic during the probe. Include queue/steering, competing resume attempts and agent survival limits where relevant; unsupported/unobserved capabilities must remain explicit.
