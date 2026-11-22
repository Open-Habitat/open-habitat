# Result

The verifier declares `runtime-release-v1`. `contract show --json` reports it
without reading a release; successful `verify --json` reports the running ID,
the authenticated manifest's declaration separately, and the manifest digest.
The manifest writer adds `verification_contract` before hashing/writing
`release.json`. Packaging already builds and ships that verifier, so the package
script needs no duplicated constant or metadata file. No verification bypass,
cache, or change to archive checks was added.

`TestVerificationContractSource` in the host package pins verifier/helper tokens
and the reviewed ID. A changed archive-entry bound was deliberately tried: the
test failed; restoring it passed. Comments/formatting do not alter tokens.
The nearest AGENTS.md defines when to bump versus refresh the reviewed source
fingerprint. Old manifests and unfamiliar declarations still fully verify;
malformed declarations fail parsing and changing the declaration breaks its pin.

## Verification

Tested working changes based on `ced6e2067ee3ff7fdb451905edec56d5b6d9e758`;
reviewed verifier source fingerprint
`a7ccdd1e827e750294e337bfa176829a014125cb5ca3828df5264639267bfab0`.
All final required checks passed under umask 077 and bounded execution:

- `./scripts/test-focused.sh --area go --go-package ./internal/host`
- `./scripts/test-focused.sh --area go --go-package ./cmd/runtime-release`
- `./scripts/test-focused.sh --area go --go-package ./internal/cli`
- `./scripts/test-focused.sh --area contracts`
- `python3 scripts/test-test-focused.py`
- `python3 scripts/test-prepare-release.py`
- `python3 scripts/test-prepare-release-closure.py`
- Native arm64 `scripts/package-release.sh` with a minimal synthetic web index,
  `scripts/verify-release.sh --json`, and the extracted verifier's
  `contract show --json` (reported `runtime-release-v1`).
- `scripts/test-package-socket.sh` and
  `bash scripts/test-package-fixture-guard.sh` against that native product build.
- `python3 scripts/validate-project-view.py` and `git diff --check`.

Initial feedback exposed the focused runner's internal-only package selector;
it now accepts bounded cmd paths too, with selector tests. The initial amd64
cross-build verified but could not execute on this arm64 host; the native build
then passed. The fixture-guard script is not executable and was rerun via bash.
These recovered invocation failures are not claimed as passes.

No live installation, external reuse implementation, real runtime rebuild,
mapped-UID readiness, browser suite, or full clean gate was run. Product packaging
here proves the shipped verifier and archive policy, not production web assets.
No test-server UI change or private operator change was made.

## Review

Targeted `/llm-review`, critical release-integrity scope, finder
`claude-fable-5-2` and independent verifier `gpt-6-astra`, followed by
`/assess-findings`. No remaining trust finding. Moved the tripwire into host so
host-focused tests run it, and corrected operator JSON-flag instructions.
Dropped speculative future review-fatigue from conservative whole-file
coverage; no issue filed. Local review and assessment artifacts are under
`history/` and are supplementary only. Performance-corpus logging was disabled
because its writer pushes and this worker was instructed not to push.

## Decisions for later review

- The ID covers `verify`, not manifest-writer product pins, extraction, installed
  runtime readiness or upgrade qualification. Combining those would invalidate
  an otherwise identical read-only verification on unrelated product changes.
- Manifest metadata is optional to keep predecessor manifests authenticatable.
  An unknown well-formed ID is metadata, never a verifier-selection instruction.
- A source-token tripwire was chosen over a label-only list of checks: changing
  a check's body must force an explicit review even when its name stays the same.
  It conservatively includes whole files; no-bump refreshes need a recorded
  explanation when the edit is outside verify or preserves its semantics.
- The query is `contract show --json`, with no release inputs or success status;
  it cannot be mistaken for evidence that a release was verified.

## External operator handoff

Replace only the binary-digest discriminator in the existing audited runtime-input
reuse path, not its other authentication or input-identity conditions. Require
an already trusted product-delivered verifier, a successful `contract show`
query, a known supported ID, and equality of that ID with both the independently
authenticated manifest declaration and the prior successful receipt's running
contract. Start with `runtime-release-v1`; absent/unknown/different IDs, legacy
receipts, unsupported query, or malformed output mean full verification. Never
automatically approve a new contract because it calls itself verified.

The reusable runtime-input key must cover the running contract, target platform,
and the complete artifact descriptors for every profile (archive digest/size,
expanded size/count, dependencies, packages, files, components and licences),
not merely archive filenames or selected core. A concrete conservative key is
SHA-256 of canonical JSON `{verification_contract, platform, artifacts}` retaining
array order and sorting object keys. Keep the receipt in trusted operator state,
write it only after full successful verification, and bind the bytes actually
used to those archive digests; mutable cache paths, timestamps or sizes alone
are insufficient.

Each new release still needs fresh independent manifest-pin authentication and
current manifest/schema/target/dependency/upgrade validation. Version/commit and
transition changes must never be hidden by the runtime-input key. If the operator
cannot establish these cheaply through its existing authenticated path, run full
verification rather than invent a weaker parser. Keep product-package checks,
current writer qualifications and all install/stage/apply/upgrade observations.
This is reuse of expensive immutable runtime-input evidence only, not a cached
claim that the new release or the installed host is ready.
