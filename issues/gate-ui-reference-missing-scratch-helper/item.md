---
created: 2026-11-13
updated: 2026-11-13
type: bug
status: untriaged
priority: high
provenance: other
provenance_detail: deterministic gate failure observed by the pilot.29 release worker
source_ref: taskfleet:01m79j3eba3ds7pb39q5pe4zfa/gate-failure:test_fast_entrypoints_allow_reference_drift
originating_run: 01m79j3eba3ds7pb39q5pe4zfa
originating_run_kind: spinoff
---

# Clean gate fails: test-ui-reference copies test-focused.sh without the scratch.sh it now sources

## Description

The clean gate on `main` fails deterministically in `scripts/test-ui-reference.py`:

```
FAIL: test_fast_entrypoints_allow_reference_drift (command=['bash', '.../scripts/test-focused.sh', '--area', 'web'])
AssertionError: 1 != 0 : .../scripts/test-focused.sh: line 32: .../scripts/scratch.sh: No such file or directory
```

`c601de6bd` (12.11.2026, "test children's scratch leaves with the run") made `scripts/test-focused.sh` source `scripts/scratch.sh`. The test copies only `test-focused.sh`, `test-web-fast.sh` and `generate-ui-reference.py` into its temporary tree, so the sourced helper is missing there. Fails 3/3 alone at `43e56fcd92787addc016c9df8096c365473e663d`; it was hidden in the first two pilot.29 gate attempts only because a Go flake failed the phase first.

Fix (verified locally, not committed): add `"scratch.sh"` to the copied names on line 24 of `scripts/test-ui-reference.py`; the test then passes. Every other gate check after it passed when run individually at that commit.

This blocks the v0.1.0-pilot.29 release: the release worker stopped at the gate.
