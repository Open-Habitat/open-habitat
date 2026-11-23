---
created: 2026-11-23
updated: 2026-11-23
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: taskfleet:01m84e7q7p8r69svcqwkjeq2v9/task:start-page-fact-check
originating_run: 01m84e7q7p8r69svcqwkjeq2v9
originating_run_kind: spinoff
preparation: ready
closed: 2026-11-23
---

# Fact-check the start page authoring skill

## Description

Jari requested this bounded fact-check on 2026-11-23 after the start-page instruction rewrite. Check internal/daemon/start-page-skill/SKILL.md against main, native tool help and installed Pi behavior; correct facts only and preserve its structure. Record evidence and limitations in result.md, run focused daemon tests, and close with the delivery commit. No lane is assigned by this worker.

## Acceptance Criteria

- [x] Check the instruction against main and installed tools; correct facts only.
- [x] Record corrections, evidence, release gaps and limits in result.md.
- [x] Run the focused daemon tests under umask 077 and relevant documentation validators.
