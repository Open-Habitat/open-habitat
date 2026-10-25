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

# Bash card polish: icon artifact, exit text, align with the bash tool block

## Description

Jari 2026-10-21 on the test server: (1) the card's open/close control shows an extra small triangle next to the chevron/terminal icon (screenshot: '>' with a stray little corner glyph); (2) 'paluuarvo 0' should read 'Valmis' for success (show the code only on failure); (3) overall the ! command card should take more after the agent's bash tool block in the conversation (same visual language for command, output disclosure and status). Fix in production; reuse the tool block's components/tokens rather than a parallel style.

## Acceptance Criteria

- [x] Command disclosure has one chevron, with pointer and keyboard operation.
- [x] Successful completion says Valmis; only nonzero exits show their code.
- [x] Live and saved commands reuse the agent tool disclosure, status and output components, without losing native block loading or exclusion metadata.
- [x] Focused browser coverage passes, including phone layout and affected accessibility checks.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
