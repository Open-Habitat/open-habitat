---
created: 2026-10-01
updated: 2026-10-01
type: task
reporter: jari
status: in-progress
priority: normal
related: ['@architecture-built-on-caution']
lane: caution-removal
lane_seq: 70
blocked_by: ['@browser-state-rewrite']
---

# Split the large files along review seams and document the check-once model

## Goal

Step 7 of the [architecture review](../../docs/reviews/architecture-review-2026-10.md) removal plan. Separate the responsibilities identified in Part 2 after the preceding removals have settled. Their cohesion, rather than a file-size limit, determines useful boundaries.

## Scope

- `web/src/app/BrowserConversation.tsx`: `useConversation(id)` (status, entries, live turn), `ConversationActions` (writes and notices), `useReadingPosition` (anchor, scroll, unseen).
- `internal/daemon/conversation_linux.go`: `drain` and `publishDelta` to `pi_events_linux.go`; `continuationProof`, `continueEnded`, `existingHistoryKeys`, `publishNativeHistory` to `continuation_linux.go`.
- `web/src/app/App.tsx`: rail into `WorkspaceRailView`.
- `internal/gateway/auth.go`: OAuth (start, callback) separate from sessions (`authenticated`, `authorizeWrite`, `current`, `logout`, revoke).
- Then rewrite `docs/architecture.md` and `internal/AGENTS.md` to say which checks belong at login or startup, which remain per request, and why, and add the three review questions (what it protects, what it costs, what if removed) to the review guidance in `AGENTS-WORKFLOW.md`.

## Result to establish

The files separate conversation loading, write actions, reading position,
Pi event handling, continuation, navigation and gateway login/session handling.
Readers can find those responsibilities without following artificial fragments
created to meet a line limit. Behaviour stays the same and existing coverage
continues to exercise it.

Architecture and agent instructions describe the implemented responsibilities,
the remaining per-request checks and the reason stable environment checks moved
to startup. Review guidance asks what a mechanism protects, what it costs and
what removing it would change.

Test selection and the final gate follow [TESTING.md](../../TESTING.md).
