---
created: 2026-10-18
updated: 2026-10-25
type: bug
reporter: claude
status: fixed
priority: normal
provenance: agent
lane: unlaned
preparation: ready
closed: 2026-10-21
---

# design-package refuses every package: credential scan flags ProcessTray.tsx

## Description

Running `python3 .claude/skills/design-package/scripts/test_assemble.py` fails four of six tests with `ValueError: possible credential in ui-code/web/src/components/ProcessTray.tsx`. The same failure reproduces at tag `pre-prune` (commit baa2ceec), so it predates the code-as-truth restructuring; any real `/design-package` run copies the same component and would stop the same way. The scanner in `assemble.py` (`scan`) matches something in ProcessTray.tsx (probably the redaction patterns for credential syntax) as a credential. Found while moving the test's fixtures out of a removed issue (`code-as-truth`).

## Acceptance Criteria

- [x] Assembly includes the current ProcessTray source byte-for-byte and produces a directory and zip.
- [x] Source references are not mistaken for literal credentials; credential signatures and literal assignments still stop publication.
- [x] Regression tests cover unquoted document credentials and cleanup after a rejected request.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
