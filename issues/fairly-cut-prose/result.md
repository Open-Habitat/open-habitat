# Result

The restart-send test now waits for the established conversation route and an editable composer before intercepting status reads. Previously its visible composer could still belong to the optimistic creation view, which is replaced when creation completes. All send-outcome assertions remain unchanged.

The landing test now drives Playwright's page clock and checks the observable reveal/hold state: unrevealed at navigation +299 ms, revealed at +300 ms, still mounted with no destination at +799 ms, destination present at +800 ms. It installs and pauses the clock before the login/navigation sequence, because Playwright's fake performance clock persists across reloads. The fast login also completes without a landing while the clock is paused before reveal.

This replaces the frame sampler's 480 ms tolerance with a strict 500 ms boundary. The first nonzero-opacity sample was taken with `performance.now()` when the animation-frame callback executed, which can be late under load; subtracting it from the removal sample underestimated the hold. No product change, timeout increase or case removal was necessary. CSS animation durations are not inferred from virtual time; this is a browser DOM-state/timer regression, not a painted-frame duration measurement.

## Verification

Base: e274d183. Synthetic host-backed Chromium evidence, ordinary warm Cedar route through the installed `npx` dispatcher; 12 independent worker hosts. No live users, providers or UID-isolation claim. No full clean gate.

- `cd web && npx playwright test tests/loading-landing.spec.ts tests/browser-conversation.spec.ts --grep 'never flashes|daemon restart loses controller' --workers 12 --repeat-each 20`: 40/40 passed in 13.2 s (14.92 s command wall time). Final formatted-source rerun: 40/40 passed in 13.6 s (15.93 s command wall time), log `/var/tmp/gate-flakes/final-formatted-repeats.log`.
- `./scripts/test-web-fast.sh`: format, lint, typecheck and all 471 unit/component tests passed; 22.23 s command wall time. Log: `/var/tmp/gate-flakes/web-fast-final.log`.
- Negative control: temporarily changed `landingMinShown` from 500 to 499, rebuilt and ran the landing case. It failed at the +799 ms still-visible assertion, as required; restored the product constant before final validation. Log: `/var/tmp/gate-flakes/negative-499ms.log`.
- Self-review: checked optimistic-to-established route ownership, preserved send rejection/uncertainty assertions, verified navigation-relative reveal and the 499/500 ms boundary, and confirmed the production source is unchanged.
- `git diff --check`, `issuectl doctor --json`, and `python3 scripts/validate-project-view.py` pass.

## Development failures and limits

Two initial clock-test iterations failed: installing the fake clock after login inherited a nonzero performance baseline; a per-document override was unreliable on a second reload. Installing before the first navigation and advancing to absolute page time 299 ms resolved both. The original restart case already passed all 20 repetitions during the first iteration. Logs: `/var/tmp/gate-flakes/repeats.log`, `clock-origin.log`, `clock-navigation.log`.

The first fast-check run stopped on a quote-formatting difference, corrected before the final checks (`/var/tmp/gate-flakes/web-fast.log`). Initial optional lookups used a missing skill path and absent diagnostic globs; the documented process skill and actual command dispatcher were then read. No missing prerequisite or review was bypassed. Dependency installation succeeded; existing npm audit/build warnings were not changed by this test-only repair.
