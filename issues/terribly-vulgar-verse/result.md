# Result

## Cause

Reproduced the original isolated failure on base `1ca6a315`. Diagnostic response logging showed the Git identity POST returning HTTP 409 while the second automatic default was still cloning; the following identity GET still showed an unset native identity. `GitIdentityHandler` uses `cloneWriter.TryLock` and refuses an overlapping clone with `workspace_busy`. The helper clicked once and never advanced after that refusal.

This is a timing dependency, not shared fixture state established by an earlier case: `worker-host.ts` starts a new host and synthetic home per case. Concurrent whole-spec work can slow the browser enough that the automatic clones finish before the click, masking the race.

## Change

The spec-local `newPerson` helper explicitly observes both readable automatic defaults as confirmed before submitting Git identity. It retains the real native identity write, gateway access filtering, locked/disabled chooser rows, optional third selection and final clone assertions. No production code, global fixture, arbitrary sleep or retry of a native write is added. The receipt case using the same automatic-login helper also gets the prerequisite.

## Verification

All checks passed after the final runnable edit:

- Ten separate invocations of `OH_PORT_BASE=24100 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec onboarding-default-repos.spec.ts --tag 'auto: the readable'`: 10/10 green (one case each, 4.1–4.2 seconds reported by Playwright).
- Five separate invocations of `OH_PORT_BASE=24100 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec onboarding-default-repos.spec.ts`: 5/5 green (five cases each, 8.3 seconds reported per spec).
- The maintained commands routed browser compute through Fleetrepo's remote runner; each invocation built current web assets and each case started a fresh synthetic host. No retries or prebuilt-assets reuse were enabled.
- `npm ci --prefix web`, then `./scripts/test-focused.sh --area web`: format, lint, typecheck and all 702 tests in 109 files passed.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json`, and `git diff --check` passed. Doctor reported existing repository-wide attachment-format advisories, with no schema or transition errors.

Runnable change: `web/tests/onboarding-default-repos.spec.ts`, Git blob `b4bfa4e3544e6b318b22e9546e0c42f47ab8f0da`, based on `1ca6a315`.

These are synthetic same-UID browser/host checks, not real GitHub or distinct-UID isolation evidence. No live service or installed binary is changed; no release gate is claimed.
