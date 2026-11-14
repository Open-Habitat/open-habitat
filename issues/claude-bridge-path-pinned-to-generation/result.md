# Result

Fixed native Claude bridge settings that outlive a release generation. Selection and first-login initialization now persist the installation's stable `core` path. Model-settings reads replace and deduplicate old entries from that same installation without looking up the old generation, preserving unrelated extensions and model preferences. Development runtimes keep their own paths.

## Validation

- `umask 077; scripts/test-focused.sh --area go --go-package ./internal/daemon` — passed.
- `node --test internal/daemon/pi-device-test/models.test.mjs` with leased scratch — 5 passed, including a synthetic installed runtime with a pruned old generation, duplicate paths, preserved settings, idempotence, fresh selection and standalone native Pi catalog loading.
- Independent review: claude-fable-5-2 finder and gpt-6-astra verifier, with local assessment. This level was chosen because existing settings must migrate across upgrades. One confirmed availability regression was fixed: failed housekeeping writes no longer suppress a readable catalog on list. A non-root 0444-settings regression passes; explicit selection still reports write failure.
- `git diff --check` — passed.

Live check: exercised the real pinned Pi helper and standalone Pi CLI against synthetic settings and installation links. No production installation was changed or upgraded.

## Decisions for later review

Repair runs on model-settings reads as well as selection/sign-in, so an existing default need not be reselected. Repair write failure is best-effort only for list; explicit writes remain strict. No new product feature or security authority was introduced.
