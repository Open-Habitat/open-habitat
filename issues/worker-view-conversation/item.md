---
created: 2026-10-26
updated: 2026-10-26
type: feature
reporter: jari
status: done
priority: normal
lane: worker-impl
lane_seq: 1
collision: [web/src/components/Spinoffs.tsx, contracts/v1/]
preparation: ready
closed: 2026-10-26
---

# Worker view: read-only conversation in Kehys, terminal inside the conversation

## Description

Implement Jari's accepted worker view (proto-worker-view rounds 1–2, Decisions there; prototypes worker-view and worker-view-2): the worker's native conversation (Pi and Claude Code) with the conversation components, no composer, the Kehys identity frame (parent link, task/issue, state, landed/preserved, profile), workers not nested in the sidebar, the raw terminal shown inside the conversation view ('Pääte keskustelussa', also while a Claude worker's history is not yet readable), and the notice that the worker is not written to but can be asked through the main agent.

## Acceptance Criteria

- [x] Worker view live for Pi and Claude workers on desktop and phone; host facts mapping a run to its native session; Go and browser tests.

