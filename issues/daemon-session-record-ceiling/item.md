---
created: 2026-11-06
updated: 2026-11-06
type: bug
status: open
priority: normal
provenance: ai-review
source_ref: taskfleet:01m6s1qfqt2wykr2fb6gc29bj7/review-finding:record-ceiling-tombstones
review_source: ai-review
originating_run: 01m6s1qfqt2wykr2fb6gc29bj7
originating_run_kind: spinoff
review_target: 6b406fb14..d2d6a909f
assessment_classification: CONFIRMED
assessment_outcome: SPIN_OFF
review_severity: should-fix
review_confidence: high
labels:
- ai-review-model:gpt-6-astra
- ai-review-model:claude-fable-5-1
lane: session-records
lane_seq: 1
preparation: ready
---

# Daemon refuses all new conversations after 128 per lifetime: stopped sessions are never evicted

## Description

`internal/daemon/conversation_linux.go` refuses a new conversation with `429 capacity_exceeded` when `len(c.sessions) >= 128` (create, worktree create, and the resume path). Stopped conversations stay in `c.sessions` as tombstones for lost-request lookup; the only removal outside tests is `delete(c.sessions, id)` in `internal/daemon/close_linux.go` (explicit close of an empty conversation). Ordinary stop, the idle stop and room stops never remove the record.

Effect: a person who starts or resumes 128 distinct conversations within one daemon lifetime (weeks of normal use on a long-running daemon) is refused every new conversation even with nothing working, and the browser shows the limit-reached card ("raja on N … ja 0 työskentelee"), whose remedies (stop one, change the limit) cannot help. Since the administrator limit may now be set to 128 (`internal/livelimits.Max`), the same happens at that limit after a single stop.

Options: evict reaped tombstones (oldest first) when the record bound is reached, since lost-request lookup is only needed briefly; and/or give record exhaustion its own refusal code so the browser does not route it to the limit card.

Found by AI review in live-conversation-limit-admin (finder gpt-6-astra, verifier claude-fable-5-1, both confirmed against code).
