---
created: 2026-10-21
updated: 2026-10-25
type: bug
status: fixed
priority: high
lane: test-throughput
closed: 2026-10-21
---

# Browser suite red: about 22 failing cases on main

## Description

The ordinary Playwright suite (302 cases) fails 22–29 cases on main (e411415b, measured 2026-10-21 on Alder natively and on the warm Cedar path). Each failure waits for its 5–90 s timeout, so a red suite is also a slow suite: 185 s on Cedar with 12 workers, of which failures are a large share. Failure sets vary between runs, so some are load/timing flakes and some are real. Log of the 12-worker run: /var/tmp/oh-browser-red-20261021.log. considerably-jagged-office is one known case. Goal: green suite, fixing product or test as the evidence says, without weakening assertions.

## Acceptance Criteria

- [x] Fix shared browser-suite root causes and unstable test assumptions without removing cases or raising timeouts.
- [x] Measure two full ordinary-suite runs and file each isolated remaining failure with its observed cause and run provenance.

See [result](result.md) for measured outcomes and the two isolated residuals.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
