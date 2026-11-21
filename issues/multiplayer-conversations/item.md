---
created: 2026-11-17
updated: 2026-11-21
type: feature
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-11-17/multiplayer-conversations
lane: multiplayer
lane_seq: 1
preparation: ready
closed: 2026-11-21
closed_by: jari
---

# Multiplayer: several people take part in the same conversation with the agent

## Description

Jari 17.11.2026: start designing multiplayer: several people participating in the same conversation with the agent, possibly more broadly. Steps he named: (1) a worker benchmarks comparable solutions; (2) decide how API keys and quota go, i.e. whose quota the conversation uses (his first thought: the person who opened the conversation); (3) architecture: how this fits Open Habitat nicely (per-person Unix users, daemon per person, native Pi sessions, workspaces under each person's ~/src, gateway authority); (4) prototype the user interface and behaviour.

Per AGENTS-WORKFLOW, the benchmark is material for discussion, not a plan; each proposal coming out of it is designed with Jari. Participation by real people and fundamental architecture are Jari's decisions.

## Decisions

### 2026-11-21T07:42:12Z · @jari

Jari 21.11.2026: the plan is good but tool use worries him. Idea to prototype as a user interface: another person may write to the agent and the agent may answer, but on a turn answering a non-owner no tools are available by default — the agent answers with text only. The owner then confirms ('voit jatkaa'), or gets a per-operation dialog; when the owner speaks, the agent again may use all tools. So whoever sent the latest message defines the tool mode. On top, the owner can mark someone trusted, who then uses the chat normally. Next action: prototype rounds from two directions, first the owner's view, then the other participant's view.

### 2026-11-21T10:04:59Z · @jari

Jari 21.11.2026 on the two rounds: card for the owner, the strip (kaista) for the participant. 1-5 as recommended (per-operation with Salli kaikki; 'Voit jatkaa' as a Habitat line; an older waiting request stays open; per-person spend later; the word 'Täydet oikeudet' instead of 'Luotettu'). 6: tool names and results are visible to participants. 7: anyone may stop any turn. Next action: architecture decision (ADR) for enforcing text-only turns, participant identity through the gateway, and live stream to several browsers; then implementation issues.

### 2026-11-21T12:57:15Z · @jari

Jari 21.11.2026 accepted ADR 0038 and all eight recommendations: (1) gateway routes participants to the owner's guest socket — the core of the feature; (2) text-only is a guard, not a boundary — understood; (3) Täydet oikeudet lends the owner's Unix user — yes, and take-back/revoke ideas get a prototype round; archived conversations cannot be opened by others; (4) gateway participation index — yes; (5) picker shows every signed-in person on the server; (6) participants see thinking exactly as the owner does; (7) wakes after a participant stay text-only; (8) broker restores the guest socket like the agent socket.

## Resolution

### 2026-11-21T12:57:36Z · @jari

Decision delivered: ADR 0038 accepted 21.11.2026; implementation in multiplayer-membership, -guest-routing, -turn-modes, -guest-stream, -browser.
