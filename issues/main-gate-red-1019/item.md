---
created: 2026-10-19
updated: 2026-10-25
type: bug
status: fixed
priority: high
lane: gate-health
lane_seq: 2
collision: [gate]
preparation: ready
closed: 2026-10-19
---

# Main gate red after 19.10. landings: resilience expiry, slow clone stage, busy-check test

Full clean gate on main `47cf99ac` (2026-10-19, after the day's landings) failed: Go `TestBusyConversationsHoldPlacesAndBlockDeletion` (pi_activity_linux_test.go:187, "idle conversations block the check": a blocker with `activity:turn`) — passes 5/5 alone, so load-sensitive; browser `tests/resilience-states.spec.ts:128` "expired session reaches login on explicit retry, not tab focus" — **fails 3/3 alone** (locator.click timeout); `tests/github-stream.spec.ts:6` "synthetic slow native clone exposes per-repository receiving stage" — fails 2/3 alone (element not found); `tests/browser-conversation.spec.ts:2163` "lost accepted reply recovers on HTTP snapshot without an event" — failed in the gate, 3/3 alone. Gate log: `/var/tmp/oh-main-gate-2026-10-19.log` on alder. Today's candidates: `streams-outlive-revocation` (sessions end streams), `stop-idle-pi`, `idle-pi-holds-slots`, `implement-interim-stages`, `hugely-dear-talk`, `git-panel-actions`, `single-mode-notice-and-url`.

## Acceptance Criteria

- [x] Explain the expiry expectation change and clone/deletion test races; keep intended product semantics.
- [x] Browser targets pass five repetitions each; busy-deletion test passes ten repetitions.
- [x] Run the full clean gate once on committed work and report its result, including unrelated load-sensitive failures, in result.md.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
