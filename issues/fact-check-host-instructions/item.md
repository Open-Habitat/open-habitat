---
created: 2026-11-23
updated: 2026-11-23
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: taskfleet:01m84cyhbna1k4nnk1ed9qdncm/request
originating_run: 01m84cyhbna1k4nnk1ed9qdncm
originating_run_kind: spinoff
preparation: ready
closed: 2026-11-23
---

# Fact-check browser agent host, helper and participant instructions

Requested by Jari on 2026-11-23: verify the three injected instruction files against main, installed tools and referenced skills; correct facts without restructuring.

## Acceptance Criteria

- [x] Fact-check host, helper and participant guidance and correct established factual errors.
- [x] Preserve structure and report evidence, installed/main differences and unverified claims in result.md.
- [x] Pass focused daemon Go checks under umask 077.

## Implementation Notes

See result.md for corrections and the claim-by-claim evidence groups. No live service or account operation was performed.
