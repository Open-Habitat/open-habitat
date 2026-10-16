---
created: 2026-10-15
updated: 2026-10-16
type: task
reporter: jari
status: done
priority: high
lane: proto-details
lane_seq: 1
collision: [design-system/prototypes/rounds/proto-conversation-details]
preparation: ready
closed: 2026-10-16
---

# Prototype: archive notice, Viimeisimpään button, failed bash card

Jari 15.10.2026: every new feature is prototyped first; the working prototype Jari accepts is its specification, and implementation waits for his evaluation. The round is made in its own worktree under `design-system/prototypes/AGENTS.md` ("Prototyyppiworker") and the `prototype` skill. Alongside it, an architecture sketch says how the server side would do it, in a separate file, following the project principles in `CLAUDE.md` (Unix users as the boundary, native tools own their history, credentials and processes; no parallel store or broker). The sketch is a proposal for Jari, not an accepted ADR.

From the prototype queue (TODO.md): the floating notice after archiving a conversation, the Viimeisimpään (jump to latest) button as a whole, and the failed bash card. One round per item or one round with three axes, whichever reads better for Jari. No architecture sketch is needed.

## Acceptance Criteria
- [x] Round(s) verified with check.mjs; `result.md` per the prototype worker rules.

## Decisions

### 2026-10-16T06:02:23Z · @jari

Jari 2026-10-16: failed bash card, direction 'Syy kulmassa'. This implies that the daemon may read Pi's own fixed-format status line (Command exited with code N / timed out / aborted) into a structured field, falling back to 'epäonnistui' when it does not match.
