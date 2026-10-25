---
created: 2026-10-21
updated: 2026-10-25
type: bug
status: fixed
priority: normal
provenance: chat
source_ref: taskfleet:01m5eqjyh987kygfhe2kddtnd7/task
originating_run: 01m5eqjyh987kygfhe2kddtnd7
originating_run_kind: spinoff
closed: 2026-10-21
---

# Remaining browser/lab flakes after 21.10.

## Description

## Reproduction
Gate on da46fc2e: lab-composer-area.spec.ts queue follow-up count was zero instead of one. Stress lab five times and ordinary browser twice, fix root causes without weakening assertions or raising timeouts, then repeat both stress runs and fast web checks.

## Acceptance Criteria
- [x] Final lab repeat-each 5 and ordinary repeat-each 2 have zero failures.
- [x] Fast web checks pass; root causes and timings recorded.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
