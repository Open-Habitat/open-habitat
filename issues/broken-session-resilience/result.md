# Result

Implemented in 91f3dd02; regression-test corrections in 911aa02e.

The daemon exposes complete native records when only the final, non-newline-terminated JSON record is incomplete, including a cut inside a UTF-8 rune. Both history readers hash the original bytes and preserve file/UID/stability checks. Completed malformed records remain errors. The history page carries `cut_off`; both browser history presentations explain the loss and offer a new conversation. Continuation and history-writing reconciliation refuse the damaged tail rather than repairing or appending to it. Archive/restore changes only presentation and still requires the existing ownership fence, process census, revision and active-child checks. The archive regression exercises a real synthetic unknown writer against the cut-off file and verifies byte preservation. Test-owned controller mutations now take the controller mutex.

## Verification

Final runnable revision: 911aa02e (dirty captures before its commit have the same final runnable bytes). All execution below used the declared remote ARM runner, synthetic homes and identities; this is not live-provider, distinct-UID or native-amd64 release evidence.

- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: PASS twice, jobs `57db15d847e02c04654f26638ec1705d2d85811fa44779d2985efe710bcc79d8` and `6afe3b3fccd80cb66006a1ef17072576c15aea52e21978aadd79f226ae6cfc54`. Includes vet and race-enabled tests, cut-off forward/reverse history, byte preservation, strict continuation refusal, archive writer refusal and synchronized fake session state. Native Pi fixture dependencies were installed with `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts` before checks.
- `./scripts/test-focused.sh --area web`: PASS, job `e9b293e63519eb566bc745e8077312110eaff9cf0c198e8e46e31e0e38996085`.
- `./scripts/test-focused.sh --area browser --spec native-history.spec.ts`: all 11 PASS, job `06a1152aad7d75209dea4c85576f20d7b9b7cd0b2b7dfc3c5ea99d9ae715288b`. Tests warning visibility through paging, retained native messages, new-conversation link and notice accessibility.
- `./scripts/test-focused.sh --area contracts`: PASS, job `c46c15017aad2fa81675933f5742a1da563f72547314fc1e535c10f291e8cb70`; generated fingerprint drift and schema validation passed. Subsequent changes were regression tests only, not contracts.
- Same daemon check on unchanged source main `2d81ff0dee972fd2a0852c8181ea370dddb4ec56`: PASS, job `0c50e7419815fbdb850ba10680b6a5340690a32bf6f5e7b32bdc5b73d938e268`.
- `git diff --check`, project-view validation and issue doctor: PASS (doctor retains existing non-AVIF attachment advisories).

## Review and incomplete attempts

Focused self-review was proportionate: this changes same-user native parsing/presentation, not Unix-user boundaries, gateway/daemon/broker authority, authentication or installation hardening. Reviewed original-byte revision binding, malformed-record rejection, unchanged unknown-writer denial, strict write admission, UI propagation and test synchronization. No independent-model review was required or claimed.

An optional broad `./scripts/ci-local.sh --json` job `427101d4ddb4a285848119f1a87c17073f44a5d934feaba2b1df99f1a082c012` was externally cancelled; it is not passing gate evidence. Initial focused validation found a test recorder redeclaration and an assertion on pre-inline content; both were corrected. Initial browser behavior assertions passed, but a page-wide Axe scan also reached an unrelated native unknown-event heading-order violation; the final accessibility assertion targets the added notices (existing header accessibility remains tested). All required final focused checks passed; no failing check is being waived as pre-existing. Exploratory reads of guessed nonexistent paths were replaced with repository searches and had no effect on delivered work.

Synthetic before/after captures were deferred under this host's no-local-lab policy. No live server was touched and no file was repaired. The conductor must deploy; Jari's live archive of the originally broken conversation remains unverified. No Fleetrepo installation changes are needed.
