---
created: 2026-09-21
updated: 2026-09-22
type: task
status: done
priority: normal
epic: native-agent-host-architecture
lane: probes
lane_seq: 20
blocked_by: ['@probe-pi-control']
closed: 2026-09-22
closed_by: pi
---

# Verify native workspace GitHub and archive boundaries

## Goal

Determine how the accepted workspace actions can use native Git, GitHub authentication and Pi lifecycle results. Work only in disposable fixtures and this issue directory; @prepare-ui-review integrates the findings into shared docs.

## Context

Read [the delivery plan](../plan-v1-implementation/plan.md), [product goal](../../docs/product.md),
[architecture](../../docs/architecture.md), and the governing AGENTS.md files.
Use the installed workflow skills. Keep detailed work and evidence in this issue directory.
Follow ADR 0001: native histories/configuration, discovered directories, no parallel history,
workspace registry, credential broker or speculative cache. Desktop first, one server and Pi.

## Acceptance Criteria

- [x] Record inspected versions and reproducible evidence for local directories, Git init, worktree creation and native identity association.
- [x] Inspect the mapped Unix user's GitHub authorization boundary without exposing tokens. Establish a proposed create/clone authorization flow and test approach without creating or deleting real remote repositories.
- [x] Determine where hidden state, display name, archive markers, synopsis and parent context could live; distinguish native facts from the smallest justified new annotations.
- [x] Specify deletion boundaries, symlink/path escape cases, affected processes/worktrees and partial outcomes to be addressed by the contract.
- [x] Document unsupported or untested operations and exact later verification. Do not infer browser control from discovery.
- [x] Save `result.md` and disposable probe material here; change no real workspaces, credentials, running user sessions or shared documentation.

## Delivery and verification

Record exact inputs/revisions, commands, outcomes and remaining limits in this issue's
`result.md`. Update the owned durable documents; do not duplicate a task queue in TODO.md.
Run the applicable repository documentation checks. Product workers also run the exact
checks established by @plan-v1-implementation and verified by @build-app-foundation.
A failed or unavailable check is not a pass. Never close a human-review issue on the user's behalf.
Do not expand into the next issue after delivering this bounded task.
