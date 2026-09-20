---
created: 2026-09-20
updated: 2026-09-20
type: task
status: in-progress
priority: normal
epic: native-agent-host-architecture
lane: architecture-docs
lane_seq: 40
---

# Finalize the architecture wording and UI design handoff

## Goal

Review and land the documentation changes already prepared in the working tree, including the v1 briefs and issue-based handoff.

## Context

The previous turns prepared these changes locally; they are not yet committed or published. The v1 zip files were copied and hash-verified in rowan:/Users/maintainer/Downloads on 2026-09-20. Do not lose or recreate this existing work. A stint requires a clean source tree before spawning; reconcile this local work first.

Sources: [architecture](../../docs/site/architecture.md),
[design package](../native-agent-host-architecture/ui-design-package.md),
[conversation v1](../native-agent-host-architecture/ui-design-conversation.md).
Detailed plans and results for this task belong in this issue directory.

## Scope

Keep native histories, component configuration and subprocess ownership with their
native components. Use the agreed HTTP/SSE path. Do not add a workspace registry,
parallel history store, credential broker, internal tenant model or speculative cache.

## Acceptance Criteria

- [ ] Preserve the agreed Unix/open-source philosophy, directory workspaces, native configuration and one deployment per tenant.
- [ ] Review docs/AGENTS.md, the seven site pages and validator change together; preserve useful checks without requiring process boilerplate.
- [ ] Include the two standalone design briefs, the later-feature list, TODO.md and linked issue metadata in the reviewed change.
- [ ] Run python3 docs/validate-project-view.py, the Glasspad dry-run build, issuectl doctor, issuectl DAG validation and git diff --check.
- [ ] Commit the reviewed documentation and planning changes; record the commit. Treat publication as a separate action after landing, following docs/AGENTS.md.
