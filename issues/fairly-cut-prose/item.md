---
created: 2026-10-21
updated: 2026-10-25
type: bug
status: fixed
priority: normal
provenance: other
source_ref: taskfleet:01m5ept62n49t6nbwj5dtygepr/gate-flakes
originating_run: 01m5ept62n49t6nbwj5dtygepr
originating_run_kind: spinoff
closed: 2026-10-21
---

# Browser restart composer and landing minimum flakes under load

## Description

## Description

Full gate on e274d183 (/var/tmp/oh-gate3-1792568469.log) passed 300/302 ordinary cases with 12 workers. The daemon-restart send case filled the optimistic composer while conversation creation could still remount it. The loading-landing case sampled a visible span of 476 ms against its 480 ms assertion; the product requires a strict 500 ms minimum.

## Reproduction

Run the two cases under 12-worker ordinary-suite load. Wait for established conversation state before injecting status failure, and measure the landing rule on the browser clock without weakening it or increasing timeouts.

## Acceptance Criteria

- [x] Restart-send regression passes 20 repeats with 12 workers.
- [x] Landing regression strictly checks 500 ms and passes 20 repeats with 12 workers.
- [x] Fast web checks pass; self-review completed.

## Resolution

### 2026-10-21T07:53:28Z · @issuectl

Verified both cases 20 times each at 12 workers; strict 499/500 ms negative control and fast web checks pass. See result.md.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
