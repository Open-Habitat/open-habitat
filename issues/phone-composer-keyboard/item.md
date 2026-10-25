---
created: 2026-10-20
updated: 2026-10-25
type: bug
reporter: jari
status: fixed
priority: normal
lane: phone
lane_seq: 1
collision: [web/src/app/layout-phone]
closed: 2026-10-20
---

# Phone: the keyboard covers the text field, and opening a conversation with a status overview does not scroll to the bottom

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20 on phone: while writing, the on-screen keyboard sits on top of the composer text field. Opening a conversation that shows the status overview (tilannekatsaus) does not bring focus/scroll all the way down. Use visualViewport / interactive-widget handling so the composer stays above the keyboard; scroll to the latest content on open including the overview. Verify on iOS Safari and Android Chrome emulation.

## Acceptance Criteria

- [x] Keep the phone composer above the keyboard during visual viewport resize/pan.
- [x] Open conversations with an overview at the latest transcript content, preserving draft/focus through keyboard dismissal.
- [x] Verify iPhone/Android mobile emulation and record native-browser limits in result.md.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
