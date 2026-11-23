# Result

Updated gog from 0.39.1 to 0.48.0 for linux-amd64 and linux-arm64. Archive and
executable digests, regenerated binary-bound notices, host installation version
requirements, runtime assertions and the operator inventory agree. No Google
scope, consent flow, native store, timeout or background-service change.

## Compatibility review

Read the upstream tagged changelog from 0.40.0 through 0.48.0 on 2026-11-23
(sources in [research.md](research.md)). Agent-facing changes include strict
Gmail detail-fetch failures, exit 4 for revoked/expired grants, JSON error and
pagination metadata, a status view for bare invocation, corrected Gmail queries,
explicit Google Ads opt-in, Calendar window validation and empty-field clearing,
Docs 404 exit 5, local-only new backups and longer API retry budgets.

Habitat uses explicit services and credentials/token import, list and export,
not bare invocation, automatic reauthorization or backup initialization. Its
local native-store operations remain compatible and keep their existing bounds.
The new keyring service-account/rekey/relay capabilities are not enabled.

## Verification

Tested the combined two-pin diff based on
`41c214dcba83b80a5d491cea5e649ce2a7aca9da`, natively on Linux arm64. All required
worker checks passed. Commands used umask 077, bounded timeouts and the scratch
lease. Evidence: `/var/tmp/agent-keep/runtime-pins-glab-gog/`.

- Both downloaded gog archives match the upstream release asset SHA-256s;
  independently extracted executable hashes match both lock records.
- `scripts/go-binary-notices.py generate --out NOTICE AMD64 ARM64` succeeded,
  followed by `check` against both binaries. The existing json5 supplement and
  full dependency licence texts remain present.
- `scripts/build-profile-runtime.sh --target linux-arm64 integrations OUTPUT`
  passed. The combined glab/gog archive SHA-256 is
  `53bfbcd4be0b75b0f188ba1df52785ac25de1ad3cd0dbecc9f3d2bb059c73ea5`
  (179322240 bytes; 12626 entries).
- `python3 scripts/test-integrations-runtime.py OUTPUT CORE_RUNTIME` passed,
  including sealed file/component digests, licence bindings, native executable
  versions, npm closure and wrappers. Core was used read-only with synthetic homes.
- A freshly compiled `runtime-release` wrote and independently verified a
  synthetic test manifest with the rebuilt integrations and a reused, fully
  reverified arm64 core archive. Manifest/descriptor are retained with evidence;
  this is not a fresh core build or release publication.
- Native built gog accepted product-shaped `auth credentials set`, token import,
  list and pipe-backed export. It also listed/exported a synthetic store written
  by verified 0.39.1; both accounts retained Calendar read-only scopes. The
  evidence directory holds `gog-smoke.py`; no provider requests or real tokens.
- Focused Go runner passed `./internal/host`, `./internal/nativegitlab`,
  `./internal/daemon/integrations`, `./internal/daemon` and `./internal/cli`;
  host and native glab interoperability checks passed again after sealing.
- Profile builder tests: 16 passed. Focused browser specs `gitlab.spec.ts`,
  `google-personal-accounts.spec.ts`, `onboarding-google-drive.spec.ts`:
  7 passed with two workers.
- Project-view validation, issue doctor and whitespace checks passed.

## Review and limits

Focused self-review covered target-specific archive/executable hashes, notice
inventory binding, version expectations and unchanged Google auth/scopes. No
session, daemon-state, wire or authorization boundary changed, so no independent
model review was required. The verification contract stays v1: the installation
version requirement changes, not manifest verification semantics.

Native amd64 builds/execution, real Google consent/API calls, distinct-UID
installation and deployment remain unverified. The full browser suite and clean
gate were intentionally excluded by the brief. Nothing was installed or pushed.

## Decisions for later review

None. Kept explicit scopes and the existing file backend; optional upstream
services and credential-management features remain outside the bump.
