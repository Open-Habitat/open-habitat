---
created: 2026-10-20
updated: 2026-10-25
type: bug
reporter: jari
status: cannot-reproduce
priority: high
lane: integrations-ui
lane_seq: 1
collision: [integrations-ui]
closed: 2026-10-20
---

# Brave crashes while typing an email address in the IMAP integration form

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20 (pilot.247, Brave on macOS): Asetukset › Integraatiot › Sähköposti (IMAP) › Yhdistä…; typing maintainer@example.org crashes the whole browser right after the characters j, a, r regardless of typing speed. Likely a per-keystroke behaviour in the form (provider auto-discovery request, datalist/autocomplete suggestions, a heavy regex or re-render loop, or an input attribute Brave's autofill mishandles). Reproduce in Chromium-based browsers (Brave if available, else Chromium with the same inputs), find the trigger and fix it; even if the root cause is a Brave bug, avoid the trigger. Done: typing an address works, regression test on the trigger.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
