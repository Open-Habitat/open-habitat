# Result

Added root-only `runtime-release install --directory DIR --version VERSION
--manifest-sha256 DIGEST --select core` for manually installed products.
It consumes the `runtime/` closure produced by release preparation, shares host
staging/publication/link writers and Pi-selector serialization, and leaves the
product, services and site settings alone. `docs/operations.md` documents use.

The shared host operation lock and journal checks refuse host-managed or
interrupted installation/upgrade state. Complete core closure and package
minimums are required. Bad archives do not change selection; retries verify
archives and published bytes. Selection errors restore both outputs, including
errors after rename; an unsuccessful recovery is reported explicitly. As with
host selector publication, process interruption between the two writes is not
crash-atomic and requires a retry.

## Decisions for later review

- Support only explicit `--select core`, rather than implicitly installing
  optional profiles or integrations: these require additional host policy.
- Use `generations/runtime-<manifest-digest>` and preserve product `current`,
  rather than pretending a runtime-only tree is a complete host generation.
  Reuse the exact host staging, publication, link and selector functions.
- Require existing package minimums instead of running apt: this operation
  publishes runtime bytes, not host configuration. Keep root as the only caller.
- Retain generations instead of automatic pruning; running processes may use
  predecessors. Use explicit `--prefix` for disposable qualification, not an
  environment-dependent installation path.
- Reject an existing selector mode other than 0600/0644 before selection,
  because the shared recovery writer cannot restore other modes exactly.

## Verification

- Focused `internal/host` package suite passes.
- `cmd/runtime-release` tests pass using the repository's short scratch helper;
  `test-focused.sh` currently accepts only `./internal/...` package selectors.
- Disposable tests cover rerun, corrupt archive, modified generation, manual
  product preservation, root refusal, incomplete closure, interrupted journal,
  untrusted selectors and selection recovery after either writer's rename.
- Independent critical `/llm-review` and `/assess-findings`: claude-fable-5-2
  finder, gpt-6-astra verifier plus one narrow critical continuation. Five
  actionable clusters fixed, one speculative retention candidate dropped.
- Project-view validation and `git diff --check` pass.
- No real runtime, root package operation, browser suite or full host apply was
  exercised. Root deployment and actual runtime startup remain live checks.

Live check: on a manually installed test host, install its prepared runtime
closure with the approved digest, repeat the command, and start a new Pi turn.
Both calls should report `installed`; existing processes remain untouched.
