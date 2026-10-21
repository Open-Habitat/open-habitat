---
created: 2026-10-18
updated: 2026-10-21
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
