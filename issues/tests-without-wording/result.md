# Implemented; landing blocked by newer main's duplicate command card

Run: `01m5ek6zt9jh7v54nffsxk3ccv`. Harvested preserved commit `6a2d52dd` (now `dfa53675` after rebase), preserving current main's newer changes. Integrated main `6da753c8`, including native-command fix `07b8183c`, without conflicts. Final runnable source: `f8f07efc`; subsequent `ae142c3f` records the observed command regression only.

The wording cleanup finishes the archive and Git-identity helpers, storage state and file badges, scopes shell refusal to its toast, and retains native-content/disclosure checks. Existing title-response and empty-thread geometry synchronization fixes were harvested too. No test cases removed, wording assertions introduced, or timeouts increased in this follow-up. The preserved worker's text-call audit remains in the harvested commit's history; the new version assertion is a synthetic gateway value, not UI copy.

The two requested races are repaired: settings/release checks wait for the current document's finite reads and the replacement gateway; lost-reply archive waits for its real fetch/abort to finish before navigation. Additional observed focus and reconnect/recheck races are synchronized without changing product behavior or weakening assertions. Details: @phenomenally-various-jail.

## Final evidence

Commands used `umask 077`, `TMPDIR=/var/tmp`, and the configured ordinary Cedar route. Same-UID synthetic browser/host evidence only.

| Command | Result | Routed command seconds |
| --- | --- | ---: |
| `./scripts/test-web-fast.sh` | 81 files / 471 passed | 22 |
| `cd web && npx playwright test` | **301 passed, 1 failed**, 3 opt-in capture skips | 151 |
| `cd web && npx playwright test --config playwright.lab.config.ts` | 62 passed | 34 |
| `cd web && npx playwright test server-version-reload.spec.ts mutation-layer.spec.ts --repeat-each 10` | 70 passed | 58 |
| `cd web && npx playwright test reconnect-recovery.spec.ts --repeat-each 10` | 100 passed | 156 (includes queue time; Playwright 1.2m) |

Final logs: `/var/tmp/wording-land-final-{fast,ordinary,lab,repeat}.log` and `/var/tmp/wording-land-recovery-final-repeat.log`. Self-review and `git diff --check` passed. Issue doctor and project-view validation passed; repeated after final issue writes. No full gate, live-provider or distinct-UID claim.

## Required blocker and preserved work

The final ordinary suite's only failure is `command-cards.spec.ts`, second identical `!!git status`: two saved history cards but three total cards, persisting through the existing five-second assertion. The same failure occurred in the preceding integrated whole suite. Neither the command-card test nor its product implementation was changed here; it came from newer main's native-command fix. Filed the observed residual unlaned as @exorbitantly-ragged-town, with this run's exact origin. This task does not weaken that assertion or claim the product defect fixed. The required whole ordinary suite is **not green**, so do not merge or close this issue yet.

A separate, unreproduced lab held-tool failure was recorded unlaned as @deeply-pricey-fuel; subsequent unchanged targeted repeats and whole lab passed. Earlier development validation and diagnostics, including the corrected read-tracker and navigation-gate trials, are fully inventoried in `/var/tmp/wording-land-inventory.md`. Earlier provider-layout failures did not reproduce in 12 focused cases or the final whole suite. No running command/service remains to hand off.
