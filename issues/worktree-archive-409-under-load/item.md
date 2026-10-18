---
created: 2026-10-18
updated: 2026-10-18
type: bug
reporter: claude
status: untriaged
priority: normal
provenance: agent
---

# Gate flake: lab-worktree-agent archive answers 409 under parallel gate load

## Description

In the clean gate on `d28ce108` (`OH_PORT_BASE=14600 ./scripts/ci-local.sh --clean --json`, browser and Go phases in parallel), `web/tests/lab-worktree-agent.spec.ts:21` (create, converse, ask to merge and see it merged) failed at line 140: archiving the merged worktree conversation returned 409 instead of 200. The same spec passed three times in a row alone (`./scripts/test-focused.sh --area browser --spec lab-worktree-agent.spec.ts`). The commit changed no product or test code that this spec uses (documentation and issue pruning), so this looks like a writer/settle race exposed by load, like `downright-public-cub`. 409 is the archive route's refusal for an active or uncertain writer.
