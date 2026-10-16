---
created: 2026-10-16
updated: 2026-10-16
type: feature
reporter: jari
status: open
priority: high
lane: web
blocked_by: ['@refresh-without-session-reads']
collision: [web/src/app/, web/src/components/, contracts/v1]
preparation: ready
---

# One browser mutation layer: optimistic, pending and confirmed classes (ADR)

Steps 2–4 of `issues/ui-responsiveness-review/analysis.md`. Jari accepted on 2026-10-16 the three-class rule a parallel agent proposed (quoted in his message): who owns the fact the click changes decides. Write the ADR (next free number in `docs/decisions/`, status Accepted by Jari 2026-10-16) and implement it.

| Class | Shown at once | Here |
|---|---|---|
| Optimistic | The result, normal; confirmation in the background | workspace hide/undo, archive/restore (a real refusal such as a terminal Pi writing the session is shown clearly), rename, default model, settings toggles, filters |
| Pending | The result greyed and marked pending | send (Kupla odottaa), new conversation, new workspace and git init, closing an empty conversation, interrupting a turn |
| Confirmed | Only that the command is on its way (control changes state, local spinner) | deletion, GitHub publish and clone, API keys and sign-ins, admin flags and quotas, model catalog fetch, recap |

Rules: pending is steady, not blinking (dim plus a small mark); nothing is built on a pending item (its controls wait or queue until confirmed); after ~2 s without confirmation it says the confirmation is slow; a refusal reverts in place with its reason and keeps the person's input (e.g. a draft); uncertain is not refused (transport loss or 5xx keeps the item pending and checks the receipt; a typed 4xx such as 409 or 429 is a definite refusal, see `practically-sassy-morning`); every pending item has a client command id so it cannot apply twice. The overlay lives only in memory, keyed per command, dropped on confirmation, failure or identity change: no second store of truth. Mutation replies carry the changed resource and the daemon publishes workspace changes on the event journal, so a full snapshot refetch is not the confirmation path (contract change in `contracts/v1/`). Migrate the workspace actions first, then fold `pendingArchive`/`pendingClose` in.

## Acceptance Criteria
- [ ] ADR accepted and recorded; every mutation goes through the layer (lint or test guards new direct calls).
- [ ] Hide/restore/archive/rename feel immediate in the lab at 200 ms latency; refusal, slow-confirmation and uncertain paths each have a browser test.
