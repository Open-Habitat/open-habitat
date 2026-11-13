---
created: 2026-11-13
updated: 2026-11-13
type: task
status: open
priority: normal
provenance: other
provenance_detail: pilot.29 clean gate failure (taskfleet run)
source_ref: taskfleet:01m79mf2ybkz1qpjbr18wj5ng3/gate-failure:ui-reference-copied-scripts
originating_run: 01m79mf2ybkz1qpjbr18wj5ng3
originating_run_kind: spinoff
lane: unlaned
preparation: ready
---

# test-ui-reference copies a hand-kept script list that misses scratch.sh

## Description

pilot.29's clean gate on Birch (13.11.) failed deterministically in `scripts/test-ui-reference.py`
`test_fast_entrypoints_allow_reference_drift`: the test copies a hand-kept list of scripts into a
temp tree and runs `test-focused.sh --area web`, which since `var-tmp-product-scratch` sources
`scripts/scratch.sh` → "scratch.sh: No such file or directory". Raw output:
`~/.local/state/oh-release/pilot29-gate*.json`.

Fix: the test copies its entry points together with whatever they `source`, transitively, so a
new helper needs no list update. Other `scripts/test-*.py` that copy scripts copy scripts that
source nothing; checked.
