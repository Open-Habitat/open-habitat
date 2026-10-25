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

# A ! command shows two cards; the lower, over-wide one appears first

## Description

Jari on the test server (d71151f1), 2026-10-21: typing `!git status` / `!!ls` shows the command as two cards. The lower card is too wide and is the one that appears first. Expected: one Kortit card per command (implement-bash-cards), within the transcript column width, appearing once from start to settlement (live and saved).

## Acceptance Criteria

- [x] Each `!` / `!!` invocation has one card after native history takes over; repeated identical commands remain distinct.
- [x] The live card stays within the transcript column, including while running and stopping.
- [x] Saved command cards survive reload; stop and accessible expand/collapse still work.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
