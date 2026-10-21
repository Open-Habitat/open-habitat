# Result

## Cause and fix

Reproduced before fixing in the synthetic native Pi lab: the pinned Pi 1.3.0 writes tool declarations into native history and restores that selection on continuation. Registering a new extension tool does not add it to an older transcript's restored loadout. Fresh conversations passed; a conversation with an earlier loadout failed the provider-request assertion (`local_files declared=false, want true`). Folder grants are not consulted during registration, so sharing after startup was not itself the cause. No Fleetrepo installation change is required for this reproduced defect.

The release extension now adds `local_files` to the turn's selected tools before agent start, preserving the existing selection. No histories, personal settings, browser permissions or authority boundaries change. Explicit Pi tool exclusions remain effective (also used to produce the genuine older transcript in the regression).

Validated implementation commit before integration rebase: `9620fc24` (`Fixes-Issue: shared-folder-not-visible-to-agent`).

## Verification

- Before the fix: `TMPDIR=/var/tmp go test ./internal/daemon -run 'TestPiRPCNativeSyntheticProvider/legacy_loadout=true' -count=1 -v` failed as expected on the missing resumed declaration. Log: `/var/tmp/shared-folder-legacy-before.log` on Alder.
- After the fix: `TMPDIR=/var/tmp go test ./internal/daemon -run TestPiRPCNativeSyntheticProvider -count=1 -v` passed both fresh and older-loadout cases against real pinned Pi and a synthetic provider. Log: `/var/tmp/shared-folder-native-after.log`.
- `OH_PORT_BASE=18474 ./scripts/test-focused.sh --area browser --spec local-files.spec.ts`: 5 passed, including existing axe cases. Fleetrepo routed execution to Cedar. The added case completes a first turn, grants an OPFS-backed synthetic folder through the attachment UI, runs the release-provided JS list/fetch tool from the fake Pi child through its private socket, and verifies exact downloaded attachment bytes without changing conversation URL. This is real browser/controller/tool relay evidence, not real-model decision or distinct-UID evidence. Log: `/var/tmp/shared-folder-browser-retry.log`.
- The first browser attempt passed 4 cases and timed out in the new case because it selected a lab-only workspace in the ordinary synthetic host. Corrected the fixture selector to `ordinary-dir`; the complete retry passed. Original log: `/var/tmp/shared-folder-browser.log`.
- `umask 077; TMPDIR=/var/tmp go test ./internal/daemon ./test/browser-host`: passed (daemon 142.3 s, browser host 2.2 s), with the pinned SDK installed using `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts`. Log: `/var/tmp/shared-folder-go.log`. Ordinary same-UID package evidence does not establish live UID isolation.
- `node --test internal/daemon/pi-device-test/local-files.test.mjs`: passed the socket/receipt test. Log: `/var/tmp/shared-folder-js.log`.
- `./scripts/test-focused.sh --area contracts`: generated contracts clean; 63 schemas, 65 fixtures, 39 scenarios and 17 negative checks passed. Log: `/var/tmp/shared-folder-contracts.log`.
- `./scripts/test-web-fast.sh`: format, lint, typecheck and 484 tests / 84 files passed after the final fixture correction. Log: `/var/tmp/shared-folder-web-final.log`.

## Review and remaining verification

Focused self-review traced Pi's `_restoreToolsFromTranscript` and before-agent-start loadout application, checked additive selection and explicit exclusion behavior, and reviewed the changed extension plus both boundary tests. This is proportionate to a seven-line release-extension fix: the native regression demonstrates the missing-provider-tool defect, while the browser test separately verifies late grants and actual file bytes. No new identity, permission, contract or dependency surface was introduced; no external review panel was needed.

The full gate was deliberately not run (conductor owns it on main). No live user data or histories were inspected, and no live deployment was performed. Jari's real Mac/browser/provider combination remains to be verified after the next test update; a Finnish checklist entry is in `KOKEILTAVAA.md`.
