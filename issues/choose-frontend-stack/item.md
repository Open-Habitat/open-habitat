---
created: 2026-09-21
updated: 2026-09-21
type: task
status: open
priority: normal
epic: native-agent-host-architecture
lane: planning
lane_seq: 30
blocked_by: ['@review-ui-v1']
collision: [docs/, AGENTS.md]
---

# Propose the frontend and rendering stack

## Goal

Choose a justified frontend recommendation against the accepted journeys using focused, disposable trials. The decision stays proposed until @review-implementation-plan.

## Context

Read [the delivery plan](../plan-v1-implementation/plan.md), [product goal](../../docs/product.md),
[architecture](../../docs/architecture.md), and the governing AGENTS.md files.
Use the installed workflow skills. Keep detailed work and evidence in this issue directory.
Follow ADR 0001: native histories/configuration, discovered directories, no parallel history,
workspace registry, credential broker or speculative cache. Desktop first, one server and Pi.

## Acceptance Criteria

- [ ] Compare a small relevant set of options for language/view layer, routing, build, rendering mode and deployment fit; JSX references do not choose the stack.
- [ ] Decide state ownership for snapshots/SSE, local drafts, route selection and command acknowledgements; avoid overlapping state mechanisms.
- [ ] Evaluate accessible UI primitives, styling, component catalog, Markdown/code/tool/diff rendering and test tools as one maintainable whole.
- [ ] Try representative real redacted Pi history, a streaming tool event, long output and keyboard/focus behavior in disposable experiments; record versions and licenses.
- [ ] Write the recommendation and tradeoffs as a proposed ADR in `docs/`, register it in `docs/decisions.md`, and save experiment evidence here.
- [ ] Define the production component reuse boundary and exact proposed development/build/test commands without claiming a product runtime exists.

## Delivery and verification

Record exact inputs/revisions, commands, outcomes and remaining limits in this issue's
`result.md`. Update the owned durable documents; do not duplicate a task queue in TODO.md.
Run the applicable repository documentation checks. Product workers also run the exact
checks established by @plan-v1-implementation and verified by @build-app-foundation.
A failed or unavailable check is not a pass. Never close a human-review issue on the user's behalf.
Do not expand into the next issue after delivering this bounded task.
