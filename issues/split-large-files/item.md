---
created: 2026-10-01
updated: 2026-10-01
type: task
reporter: jari
status: open
priority: normal
related: ['@architecture-built-on-caution']
lane: caution-removal
lane_seq: 70
blocked_by: ['@browser-state-rewrite']
---

# Split the large files along review seams and document the check-once model

## Goal

Step 7 of the [architecture review](../../docs/reviews/architecture-review-2026-10.md) removal plan. Pure moves along the seams in Part 2; the gate proves them.

## Scope

- `web/src/app/BrowserConversation.tsx`: `useConversation(id)` (status, entries, live turn), `ConversationActions` (writes and notices), `useReadingPosition` (anchor, scroll, unseen).
- `internal/daemon/conversation_linux.go`: `drain` and `publishDelta` to `pi_events_linux.go`; `continuationProof`, `continueEnded`, `existingHistoryKeys`, `publishNativeHistory` to `continuation_linux.go`.
- `web/src/app/App.tsx`: rail into `WorkspaceRailView`.
- `internal/gateway/auth.go`: OAuth (start, callback) separate from sessions (`authenticated`, `authorizeWrite`, `current`, `logout`, revoke).
- Then rewrite `docs/architecture.md` and `internal/AGENTS.md` to say what each component checks once and never again, and add the three review questions (what it protects, what it costs, what if removed) to the review guidance in `AGENTS-WORKFLOW.md`.

## Acceptance Criteria

- [ ] No behaviour change: `scripts/ci-local.sh --clean` green with the same tests.
- [ ] No file in `internal/gateway`, `internal/daemon` or `web/src/app` over 700 lines.
- [ ] Architecture and agent instructions describe the check-once model and the review questions.
