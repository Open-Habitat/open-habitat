---
created: 2026-09-20
updated: 2026-09-20
type: task
status: done
priority: normal
epic: native-agent-host-architecture
lane: architecture-docs
lane_seq: 40
commits:
- hash: c7e6e28
  summary: Explain the Unix-native architecture in plain language
- hash: c1aa732
  summary: Prepare UI v1 design packages and issue-based work plan
closed: 2026-09-20
---

# Finalize the architecture wording and UI design handoff

## Goal

Review and land the documentation changes already prepared in the working tree, including the v1 briefs and issue-based handoff.

## Context

The changes are now committed as c7e6e28 (architecture) and c1aa732 (UI packages and issue plan). They have not been pushed or published. The v1 zip files were copied and hash-verified in rowan:/Users/maintainer/Downloads on 2026-09-20. Use the committed files for the next stint; do not recreate the completed documentation work.

Sources: [architecture](../../docs/site/architecture.md),
[design package](../native-agent-host-architecture/ui-design-package.md),
[conversation v1](../native-agent-host-architecture/ui-design-conversation.md).
Detailed plans and results for this task belong in this issue directory.

## Scope

Keep native histories, component configuration and subprocess ownership with their
native components. Use the agreed HTTP/SSE path. Do not add a workspace registry,
parallel history store, credential broker, internal tenant model or speculative cache.

## Acceptance Criteria

- [x] Preserve the agreed Unix/open-source philosophy, directory workspaces, native configuration and one deployment per tenant.
- [x] Review docs/AGENTS.md, the seven site pages and validator change together; preserve useful checks without requiring process boilerplate.
- [x] Include the two standalone design briefs, the later-feature list, TODO.md and linked issue metadata in the reviewed change.
- [x] Run python3 docs/validate-project-view.py, the Glasspad dry-run build, issuectl doctor, issuectl DAG validation and git diff --check.
- [x] Commit the reviewed documentation and planning changes; record the commit. Treat publication as a separate action after landing, following docs/AGENTS.md.

## Resolution

### 2026-09-20T04:24:34Z · @issuectl

Reviewed and committed architecture wording, UI v1 handoff packages, follow-up issues and TODO narrative. Documentation validator, Glasspad dry-run build, issuectl doctor, structural DAG validation and git diff --check passed. No push or publication performed.
