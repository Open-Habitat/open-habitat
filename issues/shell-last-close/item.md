---
created: 2026-10-21
updated: 2026-10-25
type: bug
reporter: jari
status: fixed
priority: normal
lane: unlaned
preparation: ready
closed: 2026-10-21
---

# Closing the last shell should close the terminal panel

## Description

Jari on the test server, 2026-10-21: the last bash tab can be closed, but then the panel goes into an odd state with an unnecessary notice that bash has closed. Expected: closing the last shell closes the whole terminal panel (as if hidden), no leftover notice; reopening Pääte starts a fresh shell.

## Acceptance Criteria

- [x] Closing the last shell tab hides the terminal panel without an end notice.
- [x] Reopening the terminal starts one fresh, usable shell.
- [x] Closing one of several tabs and hiding a running shell still work.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
