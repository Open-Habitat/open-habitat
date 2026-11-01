# Result

Release packaging regenerates UI references in private Go build sources before
compiling either the shipped binary or the native skill printer. Stale or
obsolete checked-in references no longer block a release or enter its binary.
The source checkout remains unchanged, including for prepare-test-release's
clean-tree checks. Refreshed the three currently stale reference files too.

## Decisions for later review

- Retain checked-in references for direct Go development builds, but regenerate
  automatically in isolated release build sources. Removing committed copies
  would require every direct Go build/test caller to run generation first;
  regenerating in the checkout would break release preparation's clean-tree
  identity checks. Private sources preserve both ordinary Go builds and release
  cleanliness. Direct development builds can still use an older guide until
  explicitly regenerated; released binaries cannot.
- Remove freshness rejection from fast web checks and the gate. The gate keeps
  generator regressions and reproducible package verification instead. A stale
  development copy is no longer a release defect, so requiring a separate
  synchronization commit would retain the original failure mode.

## Verification

Tested the working diff based on `68fb06a3` (before final merge rebase).

- `python3 scripts/test-ui-reference.py`: 3 passing tests. Retains generator
  discovery/change/removal coverage; replaces obsolete fast-check rejection
  expectations with no-write acceptance. New package regression observes all
  three compiler calls with fresh references and no obsolete modules, verifies
  identical archives, and proves the input copies remain untouched. Compiler
  substitution in this unit test is supplemented by real builds below.
- `./scripts/test-focused.sh --area web`: passed static, type and unit/component
  checks. No web behavior changed; no browser spec or full gate run.
- `npm ci --prefix web` and `npm run build --prefix web`: passed.
- `python3 scripts/validate-project-view.py` and `git diff --check`: passed.
  `issuectl doctor --json`: no schema/reference errors; existing unrelated
  non-AVIF image inventory remains.
- Two real `linux-arm64` packages, version `0.0.0-ui-ref`: byte-identical via
  `cmp`; existing `verify-release.sh --archive ... --json`: verified without
  warnings. SHA-256:
  `7a1f26cc52a04123f422075a223299958167f03fe5973bf869b03a6086f49dd1`.
- A third real package with a deliberately stale checked-in settings reference
  was byte-identical to those packages; packaging left that stale input intact.
  The test restored the reference afterwards. Scratch packages and logs are at
  `/var/tmp/oh-ui-ref.C4r8uu` (disposable evidence).

Focused self-review traced package staging, all three Go builds, reference
removal, trimpath/determinism, prepare-test-release cleanliness and gate entry
points. No daemon logic, contracts, session state or authority path changed.
This is build/package evidence, not live deployment or model-answer evidence.

## Failures resolved during implementation

- One edit was refused because its old text matched two Go build commands;
  retried with unique complete lines, with no partial edit applied.
- Initial real package compilation exposed the root `installationpolicy`
  package missing from private sources. Included `policy.go` and its embedded
  systemd/tmpfiles inputs, then reran both builds and verification successfully.
