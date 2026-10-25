---
created: 2026-10-21
updated: 2026-10-25
type: bug
status: fixed
priority: high
lane: unlaned
preparation: ready
closed: 2026-10-21
---

# Lab browser suite red: composer-area cases and git-less warm workspace

## Description

Full gate on main 34018c54+ (2026-10-21, log /var/tmp/oh-gate-20261021.log): lab config 57 passed / 5 failed. lab-composer-area.spec.ts cases fail (focus, list width, Pi list/workspace visibility), and lab/session.mjs runs 'git rev-parse --short HEAD', which fails in Fleetrepo's warm Cedar workspace because only Git-listed files are synced, not .git. Goal: lab suite green on the warm path and natively, without weakening assertions.

## Acceptance Criteria

- [x] Lab snapshots work in Git-less source exports without syncing `.git`.
- [x] Composer journeys assert the native controls and current keyboard order without reducing coverage.
- [x] Reopening a controlled conversation follows latest through footer height changes; editor width reflow remains anchored.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
