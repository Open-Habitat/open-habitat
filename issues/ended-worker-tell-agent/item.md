---
created: 2026-10-29
updated: 2026-10-29
type: feature
reporter: jari
status: done
priority: normal
lane: ended-worker
lane_seq: 2
collision: [web/src/app/conversations.ts]
preparation: ready
closed: 2026-10-29
---

# Ended worker: Kerro agentille to the parent conversation

_Source: chat_

## Description

Implement `proto-ended-worker-lifecycle` round 3 as specified by its prototype and `result.md`, with Jari's 29.10. choice **Vanhempi**: an ended worker row's *Kerro agentille* sends, as the person's own message, a request to the conversation that started the worker (queued when busy, continued when closed, a new conversation in place of a terminal Pi). The message names the run, branch and worktree and ends with "Älä muuta mitään ennen kuin vastaan". The row shows its stage as a ring instead of the red ball and disappears once branch and worktree are gone. *Käsittele kaikki* in the Päättyneet heading and next to the top bar worker chip.

## Acceptance Criteria

- [x] Kerro agentille and Käsittele kaikki work as in the prototype, through the person's existing send path (no new authority).
- [x] Row stages and disappearance follow native Taskfleet/Git state.
- [x] Browser specs for the flows; KOKEILTAVAA line.
