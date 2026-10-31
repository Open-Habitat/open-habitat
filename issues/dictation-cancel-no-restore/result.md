# Result

Cancel (× or Esc) now discards dictation silently, keeping the pre-existing
field text and returning focus. Removed the retained words, restore action,
cancel notice and both catalog translations. The shared hook also applies to
the workspace icon wish field. Done/Enter and failure/reconnect notices remain
unchanged.

## Evidence

Tested the working diff on base `f9ea3112ac54e844c3b42fc6209d187ac382c413`.
On Birch, with private disk-backed TMPDIR and umask 077:

- `npm ci --prefix web` and `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts` succeeded.
- `./scripts/test-focused.sh --area web`: lint/types and 161 files / 1183 tests passed.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=9910 ./scripts/test-focused.sh --area browser --spec dictation-bar.spec.ts`: all five passed, including composer axe, desktop cancellation/focus, Enter finishing, and 390/360 px layout.
- Focused self-review traced cancellation through the shared hook and engine:
  cancelled views have no final text, notices remain absent, and finish/error
  handling is unchanged. No authority, contract or host changes.

Updated existing cancellation tests to require no notice instead of restore.
Removed the restore-after-edit test: it protected a deliberately removed action,
not remaining behavior. Empty cancellation and Esc during finishing retain their
coverage. Browser evidence is synthetic Soniox/microphone/fake Pi, not a live
provider or Safari check. No whole browser suite or clean gate was run.

`git diff --check` and the project-view validator passed. `issuectl doctor`
reported no schema violations; existing inventory findings were the missing item
in `flat/decisions-review-31-10` and 448 non-AVIF images.

## Decisions for later review

None beyond the explicit request: cancellation is no longer recoverable, in
both callers of the shared dictation hook. No replacement toast or undo was added.
