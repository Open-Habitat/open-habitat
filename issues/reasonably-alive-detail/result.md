# Result

`./scripts/test-focused.sh --area go` now passes on a clean worktree on Birch
with no `PYTHON` set and no system jsonschema (`internal/...` with `-race`;
every daemon schema test passes).

- `scripts/ci-python.sh` builds the venv from `requirements-ci.txt`
  (`oh_ci_venv`, which `ci-local.sh` now calls for its private venv too), and
  `oh_ci_python` keeps a shared copy under `<git common dir>/oh-ci-python/<key>`.
  The key covers the requirements and the base interpreter. The venv is built
  beside its final path and renamed into place, so concurrent runs never see a
  half-installed one.
- The `go` and `contracts` focused areas export that interpreter as `PYTHON` and
  put it first on `PATH`; a caller's own `$PYTHON` is honoured.
- `internal/testpython.Validator(t)` replaces the copies of the
  `$PYTHON`-or-`python3` fallback in the daemon and host schema tests. It checks
  once that the interpreter can import jsonschema and referencing, and otherwise
  fails with a hint to run `test-focused.sh --area go` or set `PYTHON`. A direct
  `go test` was checked to fail that way.
- The first full run then exposed the second reason a fresh worktree fails:
  30 daemon tests need the pinned Pi SDK in `internal/daemon/pi-device-test`,
  which TESTING.md asked workers to `npm ci` by hand. The focused `go` area now
  runs that `npm ci` (as the gate does) when the install is missing or older
  than its lockfile, for a whole-tree or `./internal/daemon...` run.

Checks: `test-focused.sh --area go` (rc 0, twice, the second time after review
fixes), `--area contracts` (rc 0), `scripts/test-test-focused.py` (12 OK, with
a new case asserting the Go area's PYTHON/PATH), `validate-project-view.py`.
Review: focused self-review. This changes only test tooling and test helpers, with no session,
contract, daemon-state or authorization change, so no `/llm-review` was run.

## Decisions for later review

- **Cache under the git common directory, not the worktree's `.cache/`.**
  Alternative: per-worktree `.cache/`, as ci-local's pip cache does. Workers'
  worktrees are short-lived, so a per-worktree venv would be rebuilt on almost
  every focused run. The common-dir copy is shared, keyed, and disposable:
  deleting `oh-ci-python/` just rebuilds it.
- **Focused Go area also installs the Pi SDK.** Not asked for explicitly, but
  without it a focused run on a clean checkout still failed 30 tests, which is
  the same false-failure problem. It writes only the gitignored `node_modules`.
- **ci-local keeps a private per-run venv.** It only reuses the creation
  function; its "installs remain private per run" stance is unchanged.
