# Result

`prepare-release.sh --runtime-cache ABSOLUTE_DISPOSABLE_DIRECTORY` now prepares
core and integrations with the existing native builders and current
`runtime-release manifest` verifier. It writes `OUTPUT/runtime/release.json`
and both archives; stdout remains the single product archive path. Omitting
the option preserves the existing package-only behavior.

Cache identity selects the same runtime inputs as the release cut, by content
(and executable mode), not product commit. Builds use a committed source export;
cache publication is locked and atomic, and only sealed outputs survive. Every
hit gets a fresh manifest naming the requested release version/commit and passes
the current product's closure, target and core-pin checks. Corruption fails
closed. The cache is disposable trusted build provenance, not a signature.

## Decisions for later review

- One `--runtime-cache DIR` option both enables runtime preparation and explicitly
  chooses its storage, rather than a hidden persistent cache or two coupled flags.
- Include required core/integrations, not optional profiles or an authenticated
  upgrade descriptor; those are separate operator choices. Installation and
  runtime-generation-install are unchanged.
- A foreign-architecture cache miss fails with instructions to build natively and
  transfer the matching entry. A matching trusted foreign cache can be verified
  by a disposable native Go verifier; no emulated npm build or partial success.
- Track executable mode as well as blobs: same-history release-cut diff sees
  mode changes, though its cross-history blob comparison does not.

## Test-installation handoff

A test installation's release watcher adopts this by passing
`--runtime-cache <disposable cache dir>` to `scripts/prepare-release.sh`
(holding its scratch lease and a task-specific `TMPDIR` during preparation)
and consuming `<output>/runtime/release.json` (its `commit` must equal the
prepared source) instead of building or caching the runtime itself; its
receipt keeps only the runtime's version, manifest digest and file list.
The concrete change to our installation's watcher is recorded privately.

## Verification

- Six offline closure/cache tests pass: content and mode invalidation, helper
  exclusion, committed snapshot despite checkout movement, fresh identity on
  reuse, corruption refusal, native miss/foreign cache routing, and no publication
  after verification failure.
- Preparer shell fixture passes, including option handoff, stable stdout,
  runtime source/version, absolute cache validation and existing source/gate checks.
- Focused `internal/host` suite passes; shell syntax, project-view validation
  and `git diff --check` pass. Clean gate includes the new test.
- Independent critical release-integrity review: claude-fable-5-2 finder and
  gpt-6-astra verifier. Three confirmed findings fixed and regression-tested
  (snapshot, helper naming, executable modes); no outstanding findings.
- No full native runtime download/build, actual foreign archive or installation
  was exercised. Fixtures prove orchestration, not a live release or host.

Live check: after the watcher handoff, prepare two successive test versions with
unchanged runtime inputs; both have their own version/commit in release.json,
while the two runtime archive hashes stay equal. Installation adoption remains
for runtime-generation-install.
