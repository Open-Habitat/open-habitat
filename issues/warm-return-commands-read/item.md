---
created: 2026-10-21
updated: 2026-10-25
type: bug
reporter: jari
status: fixed
priority: normal
lane: composer
lane_seq: 0
related: ['@start-page-skill']
collision: [web/composer]
preparation: ready
size: S
closed: 2026-10-21
---

# Warm controlled return reads conversation commands (gate red after start page)

## Description

Full clean gate on main 543c4e9d failed one browser spec: tests/browser-conversation.spec.ts:1034 '@browser-conversation warm controlled return reads neither status nor history' now sees a request to /api/v1/conversations/<id>/commands on a warm return, where it expects no reads. Most likely introduced by start-page-skill (b9d33294), which carries the repository start page in the command-list response for the empty state. Fix the cause (a warm return to an existing conversation must not refetch; the start page belongs to a new/empty conversation) rather than loosening the assertion, unless the read is genuinely required, in which case explain why in result.md. Gate log: /var/tmp/oh-gate-543c4e9d.json on Alder.

## Acceptance Criteria

- [x] Warm empty-conversation return makes no new command-list read, including when the original read is still in flight.
- [x] New conversations read a fresh start page; authored goals remain editable draft intent, not sends.
- [x] Retention follows conversation-window eviction and identity disposal, and failed reads remain retryable.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
