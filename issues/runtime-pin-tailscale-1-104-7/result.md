# Result

Pure pin raise: `tailscale` and `tailscaled` move from 1.104.4 to exactly
1.104.7 on linux-amd64 and linux-arm64. Implementation commit:
`ce5923bf3fb0ad2fa8d251237bfc2136fea5a004`.

Both official archives were downloaded, hashed and matched to their upstream
SHA-256 sidecars. The lock records those hashes and the measured hashes of all
four executable members. Host acceptance and archive-test version expectations
move together. Both notices were regenerated with `scripts/go-binary-notices.py`
using disposable Go 1.27.4 and both architectures' binaries, with checksum-database
verification. All four notice checks passed. The notice diff contains only
module/toolchain versions and sums, and versioned headings: no licence text
changed. The daemon's WireGuard dependency revision is included in that record.

No npm/Node, Rust, Ubuntu or application Go dependency pin changed. No source
patch changed. npm lock regeneration and Rust licence-lock regeneration are
therefore inapplicable. Verification contract `runtime-release-v1` stays unchanged:
this raises the accepted tool version, not archive-verification semantics.

## Checks

All passed against the implementation above (before the evidence-only commit):

- `python3 scripts/test-profile-runtime-build.py`: 16 tests.
- Notice `generate --out NOTICE AMD64_BINARY ARM64_BINARY` for each tool,
  then `check NOTICE BINARY` for every target/tool pair.
- `scripts/test-focused.sh --area go --go-package ./internal/daemon`.
- `scripts/test-focused.sh --area go --go-package ./internal/host`, also repeated
  with `OH_CORE_ARTIFACT_DIR` pointing to the freshly built core archive.
- `scripts/test-focused.sh --area contracts`: generated drift and schema checks.
- `scripts/build-profile-runtime.sh --target linux-arm64 integrations NEW_OUTPUT`
  and `scripts/build-core-runtime.sh --target linux-arm64 NEW_OUTPUT`: real native
  builds into fresh scratch output, locked Node and npm `--ignore-scripts`.
- `python3 scripts/test-integrations-runtime.py PROFILE_OUTPUT CORE_RUNTIME`:
  sealed inventories/digests, native versions, notices, wrappers and npm closure.
- `runtime-release manifest` and `runtime-release verify` for the complete
  arm64 core+integrations closure, synthetic version `0.0.0-runtime-test`, with
  the implementation commit above. The writer correctly refused overwriting the
  first manifest; a fresh directory was used for the committed-source manifest.
- `scripts/test-tailscale-uids.sh`: real pinned daemon in a networkless disposable
  container, distinct-UID LocalAPI denial and locked shields-up behavior.
- `scripts/test-focused.sh --area browser --spec own-machines.spec.ts`:
  six cases passed, two browser workers, synthetic host.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json`, and
  `git diff --check`.

Focused Go/browser checks ran under `umask 077`. Scratch commands held the
shared cleanup lease; network-bearing commands had outer timeouts.

Native arm64 output SHA-256s:

- Core: `12dd259432fefc8ba18144f51f20b6ea084f68134f2dd44d97d32a6e372a9635`
- Integrations: `382e23053826ab1ae2f7d21606eba6553877d0243213d504862094750ec66f40`
- Committed-source manifest: `9566c85368de801865a2c2500d4e9e1147aaad650520d0e1e7e8dcb17a25cf3e`

## Limits

amd64 archive bytes and embedded notice metadata were checked, but native amd64
execution, archive build and UID isolation remain for the test server after
publication. No real tailnet/peer connectivity, installed systemd lifecycle,
production installation, full clean gate or release qualification was exercised.
The browser cases use synthetic state, not a real Tailscale connection.
No push, deployment or release was performed by this worker.

The tracker rejected the requested `fixed` status because this issue is a chore;
it was closed as `done`, the supported completion status, without changing its
type. Closure emitted the existing missing-Acceptance-Criteria advisory; the
verification evidence is recorded above, and tracker doctor passed.
