# Result

Fixed by upgrading the pinned upstream rclone from 1.71.2 to 1.76.0 for both Linux architectures. Habitat's sync flags, deletion limits and native-state ownership are unchanged. The integrations runtime must be rebuilt and deployed; a product-only update retaining the old runtime does not deliver the fix.

## Cause and reproduction

In upstream `cmd/bisync/listing.go`, `modifyListing` processes the conflict winner's copy and then the loser's rename. Version 1.71.2 removes the original name from both saved listings when the loser changes name, even though the winner retains that name. The files on disk are correct but the deletion baseline is not. Deleting before the next ordinary pass causes the remaining winner to be classified as a new file and copied back. An intervening idle pass can repair the baseline, which explains the narrow reproduction window; the original report's exact timing is not established.

The official v1.76.0 release retains an old name when either resulting conflict name still uses it. No Habitat workaround, extra sync pass, automatic resync or listing rewrite is needed.

`TestBisyncConflictWinnerDeletion` uses the real pinned binary and an alias remote backed by a disposable local directory. It checks immediate local-file, local-folder and cloud-file deletion after a conflict, changed survivors in both directions, new files present on only one side, preserved loser contents, and another stable pass. The three deletion cases fail on 1.71.2 and all five cases pass on 1.76.0.

## Checks

Initial evidence used the working tree based on `18c67cfada2cf1f2a2e1f69d62369851766410ae`, including the final host pins and regression tests. After a clean rebase onto `652b6d41c`, repeated the native integrations suite, focused host tests, contracts, ARM64 runtime build and sealed-runtime check at `098bb84ca`; all passed. `git range-diff` confirmed both worker commits replayed unchanged.

- `scripts/test-focused.sh --area go --go-package ./internal/daemon/integrations`, with `OH_TEST_RCLONE` set to the built 1.76.0 payload binary: PASS. Includes native conflict/deletion tests, native Dropbox setup/OAuth, interrupted initial-sync resume, all-files-changed recovery and mass-deletion refusal. Old binary: expected failures in the three new deletion cases.
- `scripts/test-focused.sh --area go --go-package ./internal/host`: PASS. Required-tool publication/installation pin and its fixtures updated. `RuntimeVerificationContract` unchanged because archive-verification semantics did not change.
- `scripts/test-focused.sh --area contracts`: PASS.
- `scripts/build-profile-runtime.sh integrations <disposable-output>`: PASS on ARM64.
- `scripts/test-integrations-runtime.py <built-output> <read-only-core-runtime>`: PASS, including sealed archive inventory, notices, exact pins and native executable/wrapper checks. An initial attempt supplied the wrong core prerequisite path; rerun with the actual core runtime passed.
- `scripts/test-profile-runtime-build.py`: PASS (16 tests).
- Both official release archives checked against upstream SHA256SUMS; executable hashes pinned separately. Notices regenerated from both binaries using `scripts/go-binary-notices.py`, with module sums verified through the Go checksum database. A transient module-download TLS timeout was retried successfully.
- `git diff --check`, project-view validator and `issuectl doctor`: PASS. Generated upstream notices contain trailing spaces; a scoped `.gitattributes` rule preserves that licence text instead of editing it, while retaining ordinary whitespace checks elsewhere.

Evidence logs are under `/var/tmp/agent-keep/dropbox-conflict-winner-returns-after-delete/`: old/new binary runs, final packaged-binary integration run, host tests, runtime build and optional Microsoft fixture failures. No real files, credentials or provider accounts were used.

## Independent review

Critical `/llm-review` with claude-fable-5-2 finder and gpt-6-astra verifier, plus `/assess-findings`. The initial missing host required-tool pin was confirmed, fixed and verified. A proposed workaround for long test paths was withdrawn: the documented focused runner already supplies a short TMPDIR. No open defect in the final conflict/delete fix. Local review and assessment records are under ignored `history/`.

## Limits and separately filed failure

No live Dropbox check, installed upgrade or AMD64 execution was performed. AMD64 archive/member hashes and notice binding were checked, not its runtime behavior. Full browser suites and the clean gate were intentionally not run.

The optional, unchanged `TestMicrosoftSingleGrantNativeRuntime` was additionally enabled and fails before invoking rclone: obsolete union write-scope assertions followed by a nil token-map panic. The same failure occurs with both rclone versions. Native Microsoft refresh acceptance is therefore **not** claimed. The independently reproduced fixture defect was filed unlaned as `microsoft-native-refresh-fixture-stale`, rather than chased in this task. This is separate from the passing required sync checks.

## Decisions for later review

- Use the released upstream fix rather than modifying bisync listings or adding an automatic resync. Native rclone remains the state authority, and deletion safeguards remain intact. Both version pins and their notices move together.
- A survivor changed since the conflict is copied back instead of deleted; a genuinely new file on only one side is copied to the other. Only an unchanged, previously synchronized winner follows the deletion. The tests explicitly protect these choices.
- Do not try to reconstruct prior deletion intent from already incomplete 1.71.2 listings. Such state has no reliable evidence of the missing winner; preserve the remaining copy. The fix prevents new omissions but does not retroactively infer intent.
- Keep the pre-existing optional Microsoft fixture failure separate and disclose its coverage gap. It happens before rclone is invoked and is not evidence of a new provider regression. Real-provider qualification remains outside the local-backend proof.
