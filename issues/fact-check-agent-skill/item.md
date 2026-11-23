---
created: 2026-11-23
updated: 2026-11-23
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: taskfleet:01m84f790sn3vszrv2j1vx7sae/request
originating_run: 01m84f790sn3vszrv2j1vx7sae
originating_run_kind: spinoff
preparation: ready
closed: 2026-11-23
---

# Verify personal agent skill against current implementation

Requested by Jari on November 23, 2026: fact-check internal/cli/agent/SKILL.md against current source and command help, correct factual drift only, and repeat focused CLI tests under umask 077.

## Acceptance Criteria

- [x] Check command capabilities and safety claims against source-built help, installed tools and daemon source.
- [x] Make factual corrections only in the personal agent skill.
- [x] Run focused internal/cli tests under umask 077 at least twice; no flake reproduced in nine runs, including two on the final skill.
- [x] Record corrections, evidence, limitations and remaining decisions in [result.md](result.md).

The host-context guide was not edited. The separately observed stop-help defect was filed unlaned as @agent-stop-help-background-processes.
