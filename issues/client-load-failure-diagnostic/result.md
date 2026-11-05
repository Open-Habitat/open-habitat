# Recovered client load diagnostics

Implemented without changing UI, wording, recovery timers or identity fences.
The gateway records `client_load_failed` after a browser recovers a valid
session/snapshot pair. The payload is schema-owned, content-free and bounded;
the gateway uses ordinary session/Origin/CSRF checks and logs its own session
username, never a browser-selected identity. Invalid reports are refused and a
fixed-size installation budget bounds accepted diagnostic events.

## Decisions for later review

- **Authenticated reporting only.** Alternative: accept anonymous content-free
  reports. Recovery already yields a session/CSRF pair, so accepting anonymous
  traffic buys nothing for this scope and creates another ingress policy.
  Login-required states are not load-failure reports.
- **One volatile tab episode, first failure retained, sent once after a matching
  session/snapshot pair.** Alternative: report every retry or persist failures
  across reload. Neither is needed to explain the path and both add noise or
  storage. Failed/lost/429 reports are never retried. Closing/reloading the tab
  can lose the episode; absence of a report proves nothing.
- **Tab-scoped facts, reporting identity only.** An episode can survive an
  in-place CSRF/identity rebinding: it contains no account identity or content.
  The gateway's `user` identifies the person authenticated at reporting, not
  historical ownership of the failed read. Alternative: discard on every
  rebinding; rejected because it loses useful identity-pairing diagnostics.
  This limitation is explicit in operations guidance. Login fencing/OAuth
  navigation prevents an old App instance reporting after login.
- **First failed attempt and subsequent attempts, not every identity probe.**
  `attempts` starts at the transition into landing/stale, includes that attempt
  and later load attempts. The two preliminary identity mismatches are not yet
  failures shown to the person. `read_duration_ms` covers the load attempt that
  failed; `episode_duration_ms` covers failure-state entry through recovery.
  Alternative: maintain a full per-read timeline; rejected as unnecessary data.
- **Small fixed vocabulary and caps.** Read is session/snapshot/onboarding/
  identity_pair, reason is network/http/invalid/timeout/identity_mismatch/other.
  HTTP status is observed when available, otherwise 0. Durations saturate at
  one day and attempts at 10,000. `online` is a browser hint, never a diagnosis.
  Budget: burst 20, refill one per three seconds installation-wide, including
  malformed authenticated bodies. Alternative: per-person maps; the global
  budget also bounds memory and protects the total journal rate. Busy sites
  may drop reports, which is preferable to diagnostic traffic becoming load.

## Evidence

Base: `2cf76361c8479a73d71424a52270e65d198c1fcd`; tested the final implementation
working tree before its issue commit, on Birch under umask 077, private
`/var/tmp/oh-diag.JL0xKf`, OH_PORT_BASE=12200, OH_BROWSER_WORKERS=2. Installed
both locked npm sets and requirements-ci.txt in a disposable uv venv.

- `./scripts/test-focused.sh --area go --go-package ./internal/gateway`: pass.
  New tests cover every missing/null field, unknown enums/fields, numeric bounds,
  trailing JSON, absent authentication, wrong Origin/CSRF, actual structured
  log output, budget exhaustion and refill. No raw supplied marker is logged.
- `./scripts/test-focused.sh --area contracts`: pass, regeneration clean;
  89 schemas, 136 fixtures, 43 scenarios.
- `./scripts/test-focused.sh --area web`: pass, 170 files / 1267 tests.
  Unit tests prove no report during failure, first-cause retention, attempt
  counting, numeric saturation, one send per episode and no lost-report retry.
- Named browser runs after final code change: `loading-landing.spec.ts` 9/9,
  `refresh-identity.spec.ts` 6/6, `reconnect-recovery.spec.ts` 10/10,
  `server-version-reload.spec.ts` 3/3. Extended existing journeys require a real
  gateway 204 and closed payload after offline snapshot, session network/503/
  invalid reply, deadline, identity mismatch, and stale daemon/transport recovery.
- Project-view validation, issuectl doctor and git diff --check passed.
  Doctor retains pre-existing artifact/image advisories; no new issue filed.

This is synthetic same-UID host/Chromium evidence, not Safari/iOS, actual VPN,
real user traffic, installed journald retention or distinct-UID isolation.
No whole browser suite or full clean gate was run; integrated-main checking
belongs to the conductor. No production access or deployment occurred.

## Independent review and assessment

`/llm-review` used claude-fable-5-1 as finder and gpt-6-astra as independent
verifier (two successful calls; routine rigor with externally exposed input
as the high-risk boundary; no performance logging). `/assess-findings` recorded
one FIX and one DROP; no follow-up issues.

- Confirmed/FIX: the new classified error wrapper initially hid the original
  exception from the existing optional reconnect-console classifier. Preserve
  Error.cause and unwrap it there. The verifier identified the existing
  server-version-reload invalid-outcome regression; that spec passes after fix.
- Incorrect/DROP: reporting an episode under the currently authenticated user
  was alleged to misattribute its historical identity. The data is expressly
  tab-scoped and the operations guide labels user as reporting identity; no
  historical identity is supplied or claimed. The verifier refuted it under
  that contract. The decision is listed above for later review.
- No demonstrated closed-input/CSRF bypass. Duplicate JSON keys select their
  final value, which is validated; they cannot inject free text into logs.

Scratch review/assessment artifacts were under history/ in the worker; the
findings, disposition and evidence needed after teardown are recorded here.

## Tool/sub-workflow failures

An initial source lookup assumed web/src/App.tsx rather than web/src/app/App.tsx;
corrected immediately. Some exploratory rg pipelines returned no-match exit 1;
no test failures were concealed. The first consult-llm invocation used unsupported
--prompt (exit 2, no model called); retried with --prompt-file and both review
calls completed. These were invocation/search mistakes, not product failures.
