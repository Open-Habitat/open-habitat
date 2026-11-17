---
created: 2026-11-17
updated: 2026-11-17
type: bug
reporter: conductor
status: open
priority: high
provenance: chat
source_ref: chat:2026-11-17/first-message-shift-phone-gate
lane: unlaned
lane_seq: 1
preparation: ready
---

# Clean gate before v0.1.4: first message layout shift 0.079 at 390 px while the conversation is being created

## Description

Clean gate on main 9830c64d (17.11.2026) failed in one spec: web/tests/lab-first-message-flicker.spec.ts:50 'first message layout 390 creating' — cumulative layout shift 0.0794, budget < 0.05. The 'opened' phase at 390 px passed (0.0009). This is the phone case of the first-send jolt Jari reported (first-message-flicker, turn-end-jitter fixed 16.11.); it may be a real residual shift on phones or load-sensitive. Log: ~/.local/state/oh-gate/v014-1.json (conductor's home on the staging host; search 'lab-first-message-flicker').
