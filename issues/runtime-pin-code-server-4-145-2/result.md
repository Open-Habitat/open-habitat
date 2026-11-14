# Result

Updated only the product's editor artifact lock from code-server 4.141.0 to 4.145.2: common version, both Linux URLs, prefixes and architecture-specific SHA-256 values. Launch flags, builders and other runtime locks are unchanged. No deployment was performed.

## Evidence

- Both digests match the official GitHub release API asset digests and the research values. Both complete downloads passed the unchanged builder's SHA-256 check.
- Product profile builds succeeded for linux-arm64 and linux-amd64 via `scripts/build-profile-runtime.sh`, including normalization and sealing. The unchanged builder copies the entire upstream tree, including dependency-specific licences and notices; the lock's licence list is unchanged.
- An additional archive read verified every sealed file's digest and mode, component digest and declared licence presence against its descriptor: 6,046 arm64 files and 6,045 amd64 files. Both compressed archive sizes and digests matched their descriptors.
- `python3 scripts/test-profile-runtime-build.py`: 16 passed.
- Focused Go runner: `./internal/host`, `./internal/daemon` and `./internal/gateway` each passed. Host coverage includes release closure and executable/platform rules. No Go test directly references `artifact-lock.json`.
- Focused browser runner with `OH_PORT_BASE=15100`, `OH_BROWSER_WORKERS=2`: `workspace-editor.spec.ts` and `en-shell-editor.spec.ts` passed in their intended fixture configuration (11 passed; the explicitly opt-in native case skipped).
- With `BROWSER_HOST_CODE_SERVER` selecting the newly built arm64 binary, the focused `@native-editor-tree` case passed. This exercises the real workbench through the daemon/gateway relay and observes external file creation, rename and deletion in Explorer.
- Standalone arm64 startup used the current production argument list, including the product builtin extension directory, with a disposable home. It reported code-server 4.145.2 / Code 1.145.2, created a mode-0600 Unix socket and returned HTTP success from `/healthz` (`expired` without a workbench heartbeat). A native node-pty smoke test using bundled Node successfully ran a shell command. Processes were terminated after testing.

## Limits and unsuccessful attempts

Native amd64 execution is **not verified** on this arm64 host; the conductor must build and qualify amd64 natively at release time. Full release-manifest generation/verification is also left to the integrated release build, which supplies core and integrations alongside the editor descriptors. The standalone descriptor checks above are not a claim of full release verification.

An exploratory run of both complete browser specs with the real editor selected produced six failures and six passes. The failing cases depend on the stand-in editor's heading, DOM or file-opening instrumentation, so that configuration is not their supported proof. No test assertions were weakened: the normal fixture run passed, and the dedicated native case passed separately. Real-workbench webviews, conversation file-opening and logout/reconnect on a mapped-user installation remain live qualification, not inferred from fixture results.

The first Go invocation repeated the singular `--go-package` option and ran only the last package (gateway); host and daemon were then run separately and passed. The web-fetch tool could not open the release API; a direct HTTPS fetch succeeded and supplied both official asset digests.

## Review

Focused self-review: the sole product diff is the lock, both targets agree on version/prefix/URL, hashes match upstream metadata and downloaded bytes, licence declarations are unchanged, and no new launch flag or authority change is included. `git diff --check` and project-view validation passed.

## Decisions for later review

- Keep `--disable-file-cache` out of this bump, as directed. No existing issue matched the proposal; filed `editor-workspace-file-cache-policy` through intake, unlaned, with this run's provenance. Its policy/performance decision is separate from artifact qualification.
- Use the native-specific browser case for the real editor, rather than rewriting fixture-oriented specs as part of a lock-only bump. Preserve the remaining installation checks for release qualification.

Live check: after the conductor deploys the new editor profile to the test server, open the workspace editor, open a file from the conversation, then log out, sign in again and confirm the editor reconnects. This has not been performed by this worker.
