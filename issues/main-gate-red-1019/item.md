---
created: 2026-10-19
updated: 2026-10-19
type: bug
status: open
priority: high
lane: gate-health
lane_seq: 2
collision: [gate]
preparation: ready
---

# Main gate red after 19.10. landings: resilience expiry, slow clone stage, busy-check test

Full clean gate on main `47cf99ac` (2026-10-19, after the day's landings) failed: Go `TestBusyConversationsHoldPlacesAndBlockDeletion` (pi_activity_linux_test.go:187, "idle conversations block the check": a blocker with `activity:turn`) — passes 5/5 alone, so load-sensitive; browser `tests/resilience-states.spec.ts:128` "expired session reaches login on explicit retry, not tab focus" — **fails 3/3 alone** (locator.click timeout); `tests/github-stream.spec.ts:6` "synthetic slow native clone exposes per-repository receiving stage" — fails 2/3 alone (element not found); `tests/browser-conversation.spec.ts:2163` "lost accepted reply recovers on HTTP snapshot without an event" — failed in the gate, 3/3 alone. Gate log: `/var/tmp/oh-main-gate-2026-10-19.log` on alder. Today's candidates: `streams-outlive-revocation` (sessions end streams), `stop-idle-pi`, `idle-pi-holds-slots`, `implement-interim-stages`, `hugely-dear-talk`, `git-panel-actions`, `single-mode-notice-and-url`.
