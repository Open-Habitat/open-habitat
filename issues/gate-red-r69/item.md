---
created: 2026-11-08
updated: 2026-11-08
type: bug
reporter: conductor
status: open
priority: high
lane: unlaned
preparation: ready
---

# Clean gate on main red after round 69 landings

## Description

`./scripts/ci-local.sh --clean` on main ee62324a1 (8.11.2026 21:30, Birch):

- browser `tests/attachment-documents.spec.ts:39` — six uploaded chips expected, five after 30 s;
- browser `tests/helper-archive.spec.ts:21` — after cancelling the archive confirmation the rail's archive button is not focused (line 122);
- lab `tests/lab-conversation.spec.ts:55` — recap gaps differ by 6 px (line 214), likely the new composer stack rhythm (`composer-stack-gaps-uneven`, `composer-stack-phone-spec-selector`);
- Go `TestAgentCommandPathIsPerHomeAndInherited` — `agent-path-test-misses-core-tools`.

For each: product regression (fix the product, keeping the landed change's intent) or stale spec (update it keeping its intent) or load flake (prove by repeated runs, then harden).

## Acceptance Criteria

- [ ] Each listed case passes by name repeatedly; cause per case in result.md.
