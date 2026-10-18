---
created: 2026-10-18
updated: 2026-10-18
type: bug
reporter: claude
status: untriaged
priority: normal
provenance: agent
---

# design-package refuses every package: credential scan flags ProcessTray.tsx

## Description

Running `python3 .claude/skills/design-package/scripts/test_assemble.py` fails four of six tests with `ValueError: possible credential in ui-code/web/src/components/ProcessTray.tsx`. The same failure reproduces at tag `pre-prune` (commit baa2ceec), so it predates the code-as-truth restructuring; any real `/design-package` run copies the same component and would stop the same way. The scanner in `assemble.py` (`scan`) matches something in ProcessTray.tsx (probably the redaction patterns for credential syntax) as a credential. Found while moving the test's fixtures out of a removed issue (`code-as-truth`).
