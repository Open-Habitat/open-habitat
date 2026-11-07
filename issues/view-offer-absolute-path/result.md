# Result

`agent view offer` and `agent file offer` accept absolute sources inside or outside the workspace. Relative paths still resolve from the selected conversation workspace. Help and the shipped agent skill now show `/var/tmp/report.html` and `/var/tmp/report.pdf` and explain both path forms. Offers remain frozen copies, with existing idempotency and conversation notices.

The same-UID daemon does the reads. Symlinks in any path component, directory symlink entries, special files, relative traversal and descendant mount crossings remain refused. No gateway, browser, identity or provisioning authority changed.

## Decisions for later review

- An explicitly named absolute source may itself be a mount root, as well as reside on another filesystem. Alternative: refuse the named mount root while accepting files beneath it. Chosen because both are explicit readable sources; directory descendants still cannot cross mounts. Relative workspace sources retain their original mount restriction.
- Keep clean-path validation and the existing 1024-byte path limit rather than normalizing `..`, repeated separators or trailing slashes. Absolute support need not silently reinterpret input.

## Evidence

Tested implementation based on `66153ba8a6b8b5392c75a64974967a8c31213650`; the fixing commit contains the exact tested runnable files.

Passed, with `umask 077`, disk-backed TMPDIR and Python CI dependencies in a disposable uv environment:

- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`
- `./scripts/test-focused.sh --area go --go-package ./internal/cli`
- `./scripts/test-focused.sh --area contracts` (96 schemas, 149 fixtures, 43 scenarios)
- `./scripts/test-focused.sh --area web` (181 files, 1381 tests plus static checks)
- `go test ./internal/daemon -run '^TestOffer(Abs|sRefuseUnsafeAbsoluteSources)' -v -count=1` under a longer `/var/tmp/oh-vpath-long-test-prefix.*` directory: all cases passed, including the mount test (not skipped).
- `python3 scripts/validate-project-view.py`, `git diff --check`.

The HTTP-boundary tests cover absolute files/directories inside/outside the workspace, mixed relative/absolute file packages, dry-run, idempotent replay, frozen reads after source deletion, ancestor/leaf/walk symlinks and FIFOs. A read-only kernel-directory test checks explicit `/dev/shm` mount-root acceptance versus `/dev` → `shm` descendant refusal; it reads no device contents and changes no mounts. Existing relative-source tests remain.

Independent `/llm-review`: claude-fable-5-1 finder and gpt-6-astra verifier, followed by `/assess-findings`. Two confirmed findings fixed: long test socket names and explicit mount-root refusal. One claim dropped: unchanged permission-error mapping does not create automatic retries (CLI explicitly warns against replay). No actionable residuals. Local working artifacts: `history/review-view-offer-absolute-path.md` and `history/assessment-view-offer-absolute-path.{json,md}`.

No browser sources/specs changed, so no browser suite was run. No full clean gate, packaging, live-host offer, or separate-UID qualification was run; routes and peer checks are unchanged. npm fixture dependencies were installed from lockfiles. `OH_PORT_BASE=17100`, `OH_BROWSER_WORKERS=2` were reserved for this worker.

## Recovered check failures

- Initial CLI tests assumed the agent socket was absent, but Birch has an installed daemon. Synthetic IDs were refused by it; no offer was published. Replaced that assumption with an injected transport in both offer command tests, so final tests never contact the installed daemon.
- Initial daemon package run lacked Python `referencing`; installed `requirements-ci.txt` into a disposable uv venv, reran the entire package successfully.
- An initial focused command repeated `--go-package`, which selects only the last value. Final checks invoked each package separately.
- One exploratory `rg` used a literal brace expression and found no file; corrected to a scoped directory search. No code or evidence depended on the failed lookup.
