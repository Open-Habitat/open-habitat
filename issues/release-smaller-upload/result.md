# Reduced runtime upload — product side complete

No release was cut, uploaded, published, deleted or modified. No key was read or
moved. The first real reduced upload must wait for Fleetrepo's downloader change.

## Result and trust

An artifact may carry `archive_release`, a named immutable published release tag
in the same GitHub repository. It is only a location: its archive name, SHA-256,
size, inventory and dependencies remain in the **new release's pinned manifest**.
The product still verifies all local archive bytes before extraction; it never
contacts GitHub. The new field is itself covered by the manifest pin. Invalid,
null, empty, URL/path and self-referencing tags are refused. No trust root or
installer authority changed, so no security decision was needed.

`successor-descriptors.py --archive-release vPREDECESSOR` annotates reused
archives and preserves an existing original source across further successors.
Rebuilt profiles use their new descriptors without the field. The new
`release-upload-plan.py` checks source metadata with authenticated `gh`, requires
published immutability and matching tag/name/digest/size/uploaded state, refuses
unexpected upload files, and prints an explicit upload list. Signing/verification
still use the complete local archive closure. The plan does not replace them.

Fleetrepo intake **open-habitat-reused-runtime-download** is untriaged and unlaned,
with full Taskfleet provenance. Only its issue file was committed and pushed:
`4eaec3ca3797e396642a78eb833420632bee542d`. It specifies authenticated-manifest-first
source resolution, checks against both the manifest and source GitHub digest,
receipts and all three target transports. Existing `stage-release.sh` still gets
the complete local incoming directory; no network lookup belongs in root staging.

## pilot.18 dry-run measurement

Built actual product packages on Birch from this worktree, version label
`0.1.0-pilot.18`, base HEAD `6f81ff227564236d8e886da0ce7b885bd0b2a5e5`
(the embedded source is that parent commit; these were uncommitted candidate
builds, not release provenance). Both package verifiers passed; amd64 reports the expected
cross-architecture embedded-identity warning, arm64 executes natively.

The source manifests were downloaded from pilot.17 and matched their GitHub
stated digests before use. Candidate manifests bind the real new package
inventories and pilot.17 predecessor; their 24 runtime descriptors (12 per
architecture) point at immutable pilot.17. The planner consulted live GitHub
metadata for all references. `upload-plan.json` records every upload and reuse
name, digest and measured size; absolute scratch paths were omitted.

- **Upload: 43,585,505 bytes (41.57 MiB).** Two packages (24,438,201 bytes),
  two manifests (19,146,975 bytes), package sidecars (226 bytes) and the explicit
  dry-run ungated marker (103 bytes).
- **Reuse: 2,438,534,369 bytes (2.27 GiB), 24 archives.** None uploaded.
- About **98.24% less transfer** than uploading these assets plus all archives.

This is a measured candidate, not a release-ready cut. It has no clean-gate
receipt or signatures and was never signed. Actual signed-cut signature/public-key
assets and checksum listing add a few KiB; the real gate receipt and final source
will change metadata sizes. The 2.44 GB archive saving is exact for these inputs.
No full runtime archive download/reverification or live installation was done.
Scratch inputs, built packages and complete plan remain on Birch at
`/var/tmp/oh-upload.3hrAcA/`; the compact receipt here is the durable evidence.

## Checks and independent review

- `python3 scripts/test-release-upload-plan.py`: five tests pass, including
  mixed rebuilt/reused assets, original source retention, absent reused local bytes, missing new bytes,
  mutable/draft/wrong-tag/missing-digest sources, mismatches and unsafe inputs.
- `./scripts/test-focused.sh --area go --go-package ./internal/host`: passes
  (Python schema dependencies in a disposable uv venv; `umask 077`).
- `go test ./cmd/runtime-release -count=1`: passes. Go release tests also pass
  separately. New tests prove source metadata is pinned, cannot fetch in place
  of missing local bytes, and cannot authorize tampered archive staging.
- `npm ci --prefix web` and production build; both architectures packaged and
  `verify-release.sh --archive ... --json` passed. No web/daemon behavior changed,
  so browser suites and Pi SDK installation were unnecessary; no clean gate run.
- Real arm64 predecessor/package descriptors generated twice: the next successor
  preserves pilot.17 as original source rather than chaining through pilot.18.
- `python3 scripts/validate-project-view.py`, `git diff --check`: pass.
  `issuectl doctor --json` reports no schema/reference/metadata errors; existing
  unrelated PNG attachments remain listed as non-AVIF.
- Independent `/llm-review`, critical release integrity: claude-fable-5-1 finder
  and fresh gpt-6-astra verifier; both traced the authority and omission paths,
  ran focused tests and found no concrete defects. `/assess-findings` persisted
  an empty decision table. No review issue filed. Source-retention guidance was
  clarified. Review/assessment artifacts are under `history/`; model assessment
  was logged through the canonical Fleetrepo writer.

## Decisions for later review

- **Use the existing immutable release, not a dedicated runtime release.** A
  same-repository tag plus the existing manifest digest/size is sufficient and
  avoids a new registry or publishing step. Existing original source tags are
  retained on later successors; referenced releases must remain available.
- **Keep source optional in schema 2.** Absence means current-release bytes;
  presence adds transport metadata, not a different verification protocol.
  This also lets unchanged published predecessor descriptors be annotated.
- **Keep the planner read-only and separate from publishing.** It reports exact
  paths and bytes, refuses private/build extras, and cannot mutate immutable
  assets. Release operators consume its list rather than globbing the full
  signing/verification directory.
- **Upload from Birch where possible.** Upload needs GitHub authorization but no
  signing key. If signing is still required, it stays on Alder and only prepared
  public assets/digests move. No key migration or fleet/operator change here.
- **Close the product task with Fleetrepo as an explicit deployment prerequisite.**
  The requested product design, measured dry run and cross-repo intake are done;
  publishing a reduced release before that intake is implemented would fail
  closed in today's downloader.

## Recovered tool/sub-workflow failures

Initial path probes found no stage-release.sh in the test-VM directory and no
release_test.go; the actual Birch staging helper and Linux test files were read.
The first synthetic positive test used a closure-less fixture with VerifyArchives,
which correctly refused it; the test now exercises the existing full staging
verification seam, and all host tests pass. Package verification first used a
positional archive argument; retried with documented --archive successfully.
The focused runner rejects repeated --go-package flags and cmd/ paths; host was
rerun singly, and runtime-release tested directly. These were invocation/fixture
errors, not waived checks. No required workflow remains failed.
