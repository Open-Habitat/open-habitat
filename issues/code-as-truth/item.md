---
created: 2026-10-18
updated: 2026-10-18
type: task
reporter: jari
status: done
priority: high
lane: planning
collision: [docs/, AGENTS.md, issues/]
preparation: ready
closed: 2026-10-18
---

# Code as the single source of truth: prune descriptive docs and finished issues

## Description

Jari's decision of 2026-10-18: the repository keeps no documentation that has
already become code. Descriptions of the implemented system drift from it,
and their contradictions had made the documents untrustworthy. Intent stays
reachable through git history and the comments in the code. Documents are
still written while work is under way (ADRs, issue plans, research,
prototypes); once the code lands they go to history.

Jari's refinement in the same conversation: keep what exists nowhere else and
has an owner who notices when it goes stale. TODO.md and KOKEILTAVAA.md stay,
as do instructions (AGENTS.md files, TESTING.md, AGENTS-WORKFLOW.md),
Jari's product goal, the visual direction agreed with the designer, and the
operator guide. A comment may still name an ADR that is only in history.
The basic workflow ("jatketaan TODO.md:stä") must keep working.

## Plan

1. Write the principle into root `AGENTS.md` ("Code is the record") and the
   documents that depend on it.
2. Move the rules the code cannot show from `docs/architecture/` and the
   implemented ADRs into `internal/AGENTS.md`, `web/AGENTS.md` and
   `contracts/AGENTS.md`; move the contract validator out of an issue.
3. Tag the previous tree `pre-prune`, then remove the architecture pages,
   implemented ADRs, finished prototype rounds, one-off lab scripts and every
   closed issue that no open issue, TODO.md or KOKEILTAVAA.md names.
4. Make it repeatable: `scripts/prune-closed.py`, `scripts/from-history.sh`,
   a link check across living documents in `validate-project-view.py`, and the
   hand-off step in `AGENTS-WORKFLOW.md`.
5. Verify: doctor, validators, focused tests, and a fresh agent continuing
   from TODO.md.
