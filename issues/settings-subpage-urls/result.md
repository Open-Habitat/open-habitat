# Result: settings-subpage-urls

## Delivered

Settings selection is URL-owned. Each section has a real link under `/settings/`: `tili`, `laitteet`, `agentit`, `yhteydet`, `integraatiot`, `ulkoasu`, `tallennustila`, `palvelin`, `kayttajat`, `levytila`. Reload and back/forward restore the selected section; the mobile settings list is `/settings`. Existing internal hash links now name canonical paths. `/administration` redirects to `/settings/palvelin`.

The gateway serves the SPA shell on settings deep links and accepts only the exact canonical settings paths as OAuth return targets. Unknown settings URLs can still sign in using a safe fallback. Admin controls render only after positive server permission evidence; pending/unavailable/denied are distinct. Gateway API authorization remains unchanged.

Pi credential status is reread on entering settings, not on every subpage change. The existing single-read browser regression test caught and verified this distinction.

## Final validation

Final production implementation: `137ae713786a3cdcceebf14b1dbeaaf82d261b5c`, tree `4b64b3dee51aeb464e3ca22b188a5970f9f56da1`. A subsequent test-only commit, `7767d32e`, selects the catalog color scheme before mounting instead of measuring a post-mount theme transition; its focused validation is listed below. A conflict-free rebase incorporated main through `043f52b3`; later conductor merges remain outside that tested tree.

All execution below is synthetic Linux ARM64 runner evidence, not live-host, distinct-UID isolation, or native amd64 release evidence. Linux TMPDIR was `/var/tmp`.

- `./scripts/test-focused.sh --area web`: passed on the initial implementation; superseded by final full-health web checks, which passed format, lint, typecheck, unit and component tests after the last change.
- `./scripts/test-focused.sh --area browser --spec account-settings.spec.ts`: 13 passed on clean `a2d7d94a` (job `38338430c13930aa5b67258a39d51e700fc4eff529c8ecc1b98bc6d3650599ba`, `/var/tmp/oh-browser-pxb8tjjx`). The same cases also passed in final full health after the Pi-entry-read correction. Coverage includes canonical and unknown signed-out deep links, initial Pi gate, reload, desktop/mobile history, entry focus and mobile Axe, default model persistence, credentials, slow permission loading, and direct URL/API non-admin denial.
- `./scripts/test-focused.sh --area go --go-package ./internal/gateway`: passed (job `05ca766c31520d101cf7b0654bb916772c48526066ef55b2cf1c4fc28f4f3145`, `/var/tmp/oh-browser-98ta2awj`). Final full health also passed all Go/contracts checks after the last change, including the exact OAuth return allowlist and SPA-route tests.
- `./scripts/test-focused.sh --area contracts`: passed (job `2179a80682a39a9358bd0d5b35687598ac792ca85f5070e1f190c0eb81d371b3`, `/var/tmp/oh-browser-abpc7hz6`).
- `./scripts/ci-local.sh --clean --json`: final attempt job `d713d00f5396f149dcabad72904d9a5420826735182f3ec80f0631719cc13752`, `/var/tmp/oh-browser-m6hfw2n7`. Web checks passed; Go/contracts exit 0; ordinary browser 290 passed, 3 skipped, 6 failed. All settings tests, integrations tests and Pi single-read regression passed. This is NOT a green full gate and produced no clean-gate/ARM-health receipt. Lab config and post-browser native fixture were not reached because ordinary browser failed.

### Unchanged-main comparison

A closed disposable clone of unchanged main `211a7a7f9155ae1c35326c2ddd7c09ba65f78300` (tree `f872eb3fb488a85663572cc3165c3d719a615384`) ran the same commands without editing its source.

- Focused account spec: 11 passed, the existing observation-only conversation reload case failed because the textbox disappeared on reload. That exact assertion also failed in one intermediate worker attempt, while final worker runs passed. Evidence `/var/tmp/oh-browser-pdeyobgd`.
- Full health, job `774e0368fc254304240633a238acf6a64443d15f4612cab1cb3ef59bf81352d7`, `/var/tmp/oh-browser-8r6_rlgk`: web and Go/contracts passed, ordinary browser 287 passed, 3 skipped, 8 failed. Four final worker failures matched this unchanged-main run exactly: uncertain-send receipt recovery timeout; cross-workspace child test waiting for `Aloita uusi Pi-keskustelu`; lazy-resume waiting-message notice count 1 instead of 0; thread-fill free space 139.375 instead of >150. The earlier worker native-strip `conversation=new` failure and light provider contrast 4.48:1 failure also matched unchanged main, but passed in the final worker run.
- Clone-page focused spec on unchanged main also reproduced the final worker failure identically: fixture/first restart waits for `Aloita alusta` at clone-page.spec.ts:219 until timeout (6 passed, 1 skipped, 1 failed; `/var/tmp/oh-browser-5k1vt14q`). Focused design-system on unchanged main passed (`/var/tmp/oh-browser-waeo1r8o`); its full run had a different dark-catalog contrast failure. A second focused design-system run on unchanged main also reproduced the final full-health dark-unhappy primary-button failure identically (`/var/tmp/oh-browser-w5pdzzck`, 3.98:1, foreground `#323739` on `#4aa0ae`, 8 passed, 1 failed). Thus every remaining final production-code full-health failure was observed on unchanged main. The final worker focused design-system retry reproduced the dark-unhappy primary-button contrast failure (`/var/tmp/oh-browser-y7ewbd16`, 3.96:1). Source inspection showed the test changed `data-theme` after mounting while shared controls transition background/color; Axe was sampling intermediate colors. A test-only correction now emulates the intended scheme before navigation. This preserves actual light/dark contrast assertions and does not disable animations, Axe rules or UI controls. Focused checks of that correction are recorded below.

### Final checks after the catalog test correction

On clean test-only commit `7767d32eec3e0ea19f2c0346ce2e26e18b81834b`:

- `./scripts/test-focused.sh --area web`: passed (job `aac37e76a321bcda872d1ac79008d131a8b9f45b0c45319bdee838daa7db5c61`, `/var/tmp/oh-browser-x4d12cp9`).
- `./scripts/test-focused.sh --area browser --spec design-system.spec.ts`: 9 passed, 2 intentional capture-only skips (job `366b88ea8f40da923d8d74c611ba494a45793044e5b84ef4863e5e84c65c6ab3`, `/var/tmp/oh-browser-c_omx1zj`). Both light/dark and happy/unhappy Axe assertions passed. No rule was disabled.
- `git diff --check`, `issuectl doctor --json`, and `python3 scripts/validate-project-view.py`: passed for the final issue/result update. Doctor retains existing image-format/size warnings outside this issue.

The remaining five unrelated full-health failures qualify for the explicitly permitted unchanged-main exception. No full-gate pass or ARM-health receipt is claimed. The correction changed only the test setup; production code, Go, contracts and fixtures did not change after their final full-health validation.

## Review

An independent `/llm-review` used claude-fable-5-1 as finder and gpt-6-astra as verifier (two calls), with `/assess-findings` triage. This was warranted by OAuth return-path changes even though no Unix-user authority changed. Three confirmed findings were fixed: reject noncanonical login return targets in the browser; restore the current Tili marker on the desktop index; distinguish initial permission loading from refusal. The verifier independently checked exact same-origin returns and host-derived administrator evidence. Focused self-review then checked the final test-driven Pi-entry-read correction. No findings remain unfixed and no follow-up issue was filed.

Local scratch artifacts: `history/review-settings-subpage-urls.md`, `history/assessment-settings-subpage-urls.{json,md}`. The facts above stand without those ignored files. The final Pi-entry-read correction and removal of the speculative history-focus experiment were self-reviewed after the independent review; both retain existing behavior outside the new route selection. Model-performance logging was disabled to honor this run's prohibition on editing Fleetrepo.

## Failures and incomplete attempts

- Initial file discovery tried guessed paths/globs that did not exist; subsequent scoped searches located the actual files. A Python attempt to decode the bounded/truncated runner log failed; full artifact stdout/stderr supplied the evidence instead. These were read-only discovery failures.
- Initial formatter check caught an unescaped slash in the migrated quota-test regex; fixed and subsequent format checks passed.
- First account run: 10 passed, two failed (an extra history-focus assertion and a now-ambiguous `Yhteydet` link selector). Scoped the selector to settings navigation. An attempted animation-frame focus change did not override native history focus restoration and was removed; history coverage asserts restored URL/content, while existing entry/control keyboard-focus checks remain.
- Second account run: 9 passed, three failed (history-focus assertion, a full navigation racing asynchronous logout, and the pre-existing conversation reload failure). The logout/deep-link combination was separated from the native-state interceptor journey; canonical deep-link login is tested in the initial-gate case. Final 13-case account run passed.
- Three superseded full-health captures were deliberately cancelled before executing stale source. Their adapters exited 2 while attempting to fetch logs for cancelled jobs (`not_found`); no success was inferred. Fresh attempts replaced them.
- A contracts capture was refused with `Not untracked: web/src/app/settingsRoute.ts` after that file became committed during the preceding Go job. Retried without stale untracked selection; passed.
- Baseline process launch initially used a wrong temporary cwd and failed before starting a command. Retried with the recorded clone path.
- Finder reported its self-started Go/Vitest checks incomplete; neither was used as evidence. The worker's maintained remote checks supplied actual validation. Verifier used source only.
- The first complete worker health run found the duplicate Pi status read; fixed by keying the effect to settings entry rather than pathname, and its regression passed in final health. Other full-health failures and baseline evidence are listed above, rather than presenting a partial run as green. The final production-code full-health attempt has six failures reproduced identically on unchanged main; the catalog-test transition race was corrected separately and rechecked in its focused spec.

## Limits and handoff

Before/after screenshot+HTML captures were deferred: Alder's current focused-runner policy does not permit manual lab/capture execution. Host-backed synthetic Playwright and Axe evidence was used instead; existing test screenshots are debugging artifacts, not paired design evidence. No live server, personal data, deployment, push, or Fleetrepo installation was touched. No Fleetrepo installation change is required.
