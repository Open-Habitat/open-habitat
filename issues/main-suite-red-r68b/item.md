---
created: 2026-11-08
updated: 2026-11-08
type: bug
reporter: conductor
status: fixed
priority: high
lane: unlaned
preparation: ready
closed: 2026-11-08
---

# Integrated main browser suite red at the end of round 68

## Description

Whole browser suite on integrated main e415be007 (8.11.2026 19:30): 12 failed / 604 passed; lab 4 failed / 172 passed. Logs: `/var/tmp/oh-suite-r68b-logs/{browser,lab}.log` (Birch). Failing cases:

```
[chromium] › tests/browser-conversation.spec.ts:1494:1 › @browser-conversation warm controlled return reads neither status nor history 
[chromium] › tests/ai-sign-in-window.spec.ts:137:1 › @ai-sign-in Settings does not call a refused Claude sign-in signed in 
[chromium] › tests/process-tray.spec.ts:25:1 › @process-tray @a11y a process row opens its window: bounded output, follow and pause, stop, force s
[chromium] › tests/queued-send.spec.ts:171:1 › @lazy-resume Stop before Pi runs returns the waiting message to the field and Pi never receives it 
[chromium] › tests/quota-pressure.spec.ts:19:1 › quota warning, full storage and recovery keep the conversation mounted without resending @a11y 
[chromium] › tests/rail-turn-returns.spec.ts:34:1 › every finished turn returns a quiet conversation to Sinun vuorosi until seen 
[chromium] › tests/rail-unread.spec.ts:7:1 › @a11y unread replies wait in Sinun vuorosi, open by keyboard, and leave it only when opened 
[chromium] › tests/rail-running-after-done.spec.ts:17:1 › @rail-running-after-done a finished conversation leaves Käynnissä and returns only whe
[chromium] › tests/rail-now.spec.ts:90:1 › @rail-now a new conversation waits in Sinun vuorosi until its first message 
[chromium] › tests/status-bell.spec.ts:122:1 › @status-bell several conditions behind one bell on desktop and phone, the server's only for an admi
[chromium] › tests/rail-icons-quiet.spec.ts:413:1 › @rail-quiet a finished native conversation remains after idle stop and daemon restart, then le
[chromium] › tests/spinoffs.spec.ts:387:1 › @spinoffs sidebar marks a working spinoff without a live wait after a daemon restart, and clears when 
tests/lab-sidebar-default.spec.ts:4:3 › @sidebar-default saved default reaches settings-sidebar without reload 
tests/lab-sidebar-default.spec.ts:4:3 › @sidebar-default saved default reaches home without reload 
tests/lab-sidebar-default.spec.ts:4:3 › @sidebar-default saved default reaches workspace without reload 
tests/lab-worktree-agent.spec.ts:23:1 › @worktree-agent @a11y create, converse, ask to merge and see it merged 
```

Most are rail specs (rail-turn-returns, rail-unread, rail-now, rail-icons-quiet, rail-running-after-done, spinoffs sidebar mark), which points at this round's rail changes: `new-conversation-rail-row` (pending creation rows in Sinun vuorosi), `worker-badges-pallot` (rail ball colours), `offer-cards-and-assets-list` (bottom strip, removed Hylly panel), `recheck-button-unexplained` (refresh settling). `rail-running-after-done` already failed on main before (intake `fiercely-unkempt-look`). `lab-sidebar-default` and `lab-worktree-agent` may follow the strip/panel changes. For each, decide whether the product regressed or the spec encodes deliberately changed behaviour (read the landed issue), fix forward, keep each landed change's intent.

## Acceptance Criteria

- [x] Every listed spec passes, run by name; cause per group in result.md.
