---
created: 2026-11-12
updated: 2026-11-12
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: worker observation
source_ref: taskfleet:01m77y0mxpza1hfya7vxqf3fvm/observed:focused-go-python-venv
originating_run: 01m77y0mxpza1hfya7vxqf3fvm
originating_run_kind: spinoff
lane: unlaned
preparation: ready
closed: 2026-11-12
---

# Focused Go checks fail contract-schema daemon tests without ci-local's Python venv

## Description

`./scripts/test-focused.sh --area go` (and a plain `go test ./internal/daemon`) fails
13 daemon tests on Birch, among them TestSnapshotDiscoveryAndSchema,
TestCompactThroughPinnedPi, TestGitLabConnectListCloneFetch, TestOwnMachinesGuidedFlow,
TestTurnMark* and TestRewindThroughPinnedPi. Each fails with
`ModuleNotFoundError: No module named 'referencing'`. These tests run
`scripts/validate-contracts.py` through `$PYTHON`, which defaults to `python3`.
`ci-local.sh` exports `PYTHON` as its own venv, which has jsonschema/referencing,
but the focused entry does not. The focused Go check that TESTING.md and worker briefs recommend
therefore reports false failures unless the host's system Python happens to have
jsonschema.

Observed 2026-11-12 on main's behaviour (`TMPDIR=/var/tmp go test -run
'TestSnapshotDiscoveryAndSchema|TestCompactThroughPinnedPi' ./internal/daemon`)
and through `test-focused.sh --area go` in the var-tmp-product-scratch run.

Likely fix: give `test-focused.sh --area go` the same pinned Python environment
as ci-local (or skip these schema checks with a clear message when
jsonschema is unavailable).
