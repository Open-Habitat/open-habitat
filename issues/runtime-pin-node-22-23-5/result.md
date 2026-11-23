# Result: Node raised to 22.23.5

Node is pinned at 22.23.5 in both artifact locks, with the exact-version checks
and fixtures that `research.md` lists moved along with it. 22.23.5 is still the
newest Node 22 release on 2026-11-23 (published 2026-11-11, so well past the
48-hour minimum), so the target did not change. The major line stays at 22.

## Why the prepared bump stopped

The automatic bump changed nothing. It stopped because its task told it to stop
on any licence change and wait for the conductor. Node's bundled licence
changed in two ways:

- `deps/minimatch` moved from ISC to BlueOak-1.0.0;
- the ICU section gained the MIT notice for `sorttable.js`.

The repository itself had no gate in the way. The conductor's brief for this
run asked for that stop to be resolved and the bump finished, so this run
accepts the change on these grounds:

- BlueOak-1.0.0 is a permissive OSI-approved licence whose only condition is
  passing its text on.
- The core builder copies Node's complete LICENSE into `licenses/node.txt`. The
  built archive's copy is byte-identical to the v22.23.5 tag's LICENSE.
- The core runtime already ships npm packages under BlueOak-1.0.0 (see
  `runtime/core/package-lock.json`), so the product's licence set does not
  change.

## Changes

- `runtime/core/artifact-lock.json` and `runtime/profiles/integrations/artifact-lock.json`:
  the version, URLs, prefixes and SHA-256 for both targets. The two locks stay
  equal.
- Exact-version checks: `scripts/core-runtime-build.py`,
  `internal/host/release_closure_linux.go`, `internal/daemon/pi_runtime_linux.go`.
  Their fixtures are updated in the Go tests, `scripts/test-integrations-runtime.py`,
  `test/vm/product-fixture.py`, `test/real-pi-controller.py` and
  `scripts/test-real-pi-controller.sh` (new x64 tarball digest).
- The verification-source golden is refreshed without a contract bump. In the
  hashed files, only the pinned version literal inside the core closure check
  changed; the check itself did not, so `runtime-release-v1` stays.
- `docs/operations.md` names the new version.
- No package-lock, patch or notice file in the tree changes. Node's notices are
  generated into the archive at build time.

## Input authenticity

Both tarball digests match `SHASUMS256.txt`. `SHASUMS256.txt.asc` has a good
signature from a releaser key in `nodejs/release-keys`
(`5BE8A3F6C8A5C01D106C0AD820B1A390B168D356`).

## Verification (umask 077, linux-arm64)

- `python3 scripts/test-profile-runtime-build.py`: 16 tests OK.
- `scripts/test-focused.sh --area go --go-package ./internal/host`: ok, after
  the golden refresh above.
- `scripts/test-focused.sh --area go --go-package ./internal/daemon`: ok.
- `./scripts/build-core-runtime.sh` (arm64): built. 230 components,
  22,321 files, and `bin/node --version` reports `v22.23.5`.
- `OH_CORE_ARTIFACT_DIR=… go test ./internal/host -run TestReleaseClosureBuiltCore`:
  PASS.
- `./scripts/build-profile-runtime.sh integrations` (arm64) built, and
  `scripts/test-integrations-runtime.py` against the new core reports PASS.
- `runtime-release manifest` over core and integrations wrote the manifest, and
  `runtime-release verify` reported `verified` under `runtime-release-v1`.
- `TestPiOAuthBuiltRuntime` and `TestMCPBuiltRuntimeAgent` on the built
  runtimes: PASS.
- `python3 scripts/validate-project-view.py`: valid.

Not run:

- the linux-amd64 builds, which need an amd64 host;
- `scripts/test-real-pi-controller.sh`, which needs an x64 host and a staged
  Pi archive;
- installed multi-user and live-provider acceptance.

The amd64 archive is first built and qualified when a release is prepared on an
amd64 host.
