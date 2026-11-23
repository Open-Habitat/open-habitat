# Result

Updated glab to 1.130.0 for linux-amd64 and linux-arm64: archive and executable
SHA-256 pins, binary-bound third-party notices, installation version checks,
runtime test expectations and operator inventory. No provider, scope or native
credential-format changes.

## Compatibility review

Read upstream release notes 1.125.0–1.130.0 again on 2026-11-23 (sources in
[research.md](research.md)). `govern` becomes `minder`, package `rm` is deprecated,
environment credentials are restricted to trusted hosts, host fallback selection
changes, local config is shared across worktrees, and `GLAB_PROXY` is honored.
OAuth refresh failures no longer retry; API POST/PATCH retries and write-to-GET
redirects are restricted. These are relevant to agent-invoked commands but do
not require adapting Habitat's explicit-server PAT/native-file adapter or its
own Git credential helper. No new AutoFlow or session-upload service is enabled.

## Verification

Tested the combined glab/gog pin diff based on
`41c214dcba83b80a5d491cea5e649ce2a7aca9da`, on native Linux arm64.
Commands ran with umask 077, bounded timeouts and the shared scratch lease.
Evidence: `/var/tmp/agent-keep/runtime-pins-glab-gog/`.

- Both official glab archives match upstream `checksums.txt`; independently
  extracted executable digests match the new lock.
- `scripts/go-binary-notices.py generate --out NOTICE AMD64 ARM64` succeeded;
  `check` passed for each binary. Generation used private expiring scratch.
- `scripts/build-profile-runtime.sh --target linux-arm64 integrations OUTPUT`
  passed. The combined archive is 179322240 bytes, 12626 entries, SHA-256
  `53bfbcd4be0b75b0f188ba1df52785ac25de1ad3cd0dbecc9f3d2bb059c73ea5`.
- `python3 scripts/test-integrations-runtime.py OUTPUT CORE_RUNTIME` passed:
  sealed digests/modes, npm closure, licences, native versions and wrappers.
  The installed core was read-only; all test homes were synthetic.
- Freshly compiled `runtime-release manifest` and `verify` passed with the new
  integrations archive and a reused, fully reverified arm64 core archive.
  The synthetic test manifest and integrations descriptor are retained with the
  evidence; this is not a published release or a fresh core build.
- `scripts/test-focused.sh --area go --go-package PACKAGE` passed for
  `./internal/host`, `./internal/nativegitlab`, `./internal/daemon/integrations`,
  `./internal/daemon` and `./internal/cli`. Host checks passed again after sealing.
- The same focused nativegitlab runner with `OH_GLAB_BINARY` pointing at the
  built profile passed, including the shipped-binary PAT interoperability tests.
- `python3 scripts/test-profile-runtime-build.py`: 16 passed.
- Focused browser run of `gitlab.spec.ts`, `google-personal-accounts.spec.ts`
  and `onboarding-google-drive.spec.ts`: 7 passed, two workers.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py` and
  `git diff --check` passed.

## Review and limits

Focused self-review checked both target pins against downloaded bytes, notice
module binding, all version expectations and unchanged auth/scope behavior.
No session, daemon-state, wire-contract or authority code changed, so an
independent model review was not warranted. The runtime verification contract
remains v1: only installation tool-version requirements change, not manifest
verification semantics.

Native amd64 execution/build, live GitLab, mapped-UID installation and deployment
were not run; arm64 is the build qualification requested for this worker. The
full browser suite and clean gate were deliberately not run. Nothing was pushed
or installed on a test server.

## Decisions for later review

None. Kept the existing PAT-only integration and historical config fixture;
new upstream services and auth transports remain outside this pin update.
