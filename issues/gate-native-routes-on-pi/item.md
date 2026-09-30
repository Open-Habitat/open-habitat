---
created: 2026-09-28
updated: 2026-09-30
type: task
status: done
priority: normal
related: ['@design-first-use-onboarding', '@add-pi-device-adapter', '@verify-live-pi-journey']
lane: gateway-pi-gate
collision: [internal/gateway/, internal/daemon/, contracts/v1/, docs/]
blocked_by: ['@add-pi-device-adapter']
closed: 2026-09-30
closed_by: pi
---

# Show OpenAI onboarding when Pi sign-in is missing or uncertain

After browser login, first-use onboarding is required before normal workspaces,
native history or agent controls open. The user goes through GitHub repository
selection and checkout, then OpenAI sign-in through Pi. Selecting repositories
is optional: continuing with none selected advances to the OpenAI step.

When Pi is not signed in, show the OpenAI step of onboarding, including when the
user arrives through a direct URL or a stale tab. If Pi's sign-in state cannot
be determined, show the check failure and a retry option in that same step;
unknown state does not establish that credentials are missing.

The first-use repository chooser and checkout are the narrow exception agreed
in @github-repos-first-onboarding. They do not open the normal workspace,
history or control routes before Pi sign-in.

Pi handles credential exchange and refresh and stores credentials in its own
format in the mapped Linux user's home directory. The host has no separate
Pi credential store.
The daemon starts Pi's native device-code operation and relays its instructions
and progress; the gateway authenticates the browser and routes to that user's
daemon. This keeps Pi credentials out of the gateway and preserves ordinary
SSH/tmux use. A pending attempt belongs to both its Unix user and its browser
session: neither another user nor another login session can take it over.

An interrupted attempt or lost daemon state leaves sign-in uncertain. Recovery
comes from checking Pi's native state, so an old browser view cannot turn missing
state into a successful login. The approved device-code interaction is recorded
in @design-first-use-onboarding, with the repository-first ordering above.

The native gate, session-bound Pi attempt, direct-route browser integration and
unknown-state retry behavior have now landed. [result.md](result.md) records the
committed clean gate, production-bundle synthetic browser tests, disposable
multi-UID checks and independent review, with their limits. This closes the
**product implementation** described here, not the real-provider or test-server
acceptance. Those still-unverified scenarios are explicit checks in
@verify-live-pi-journey; its outcome may file a concrete follow-up defect.
[Repository-first evidence](../github-repos-first-onboarding/result.md) covers
the narrow exception. [TESTING.md](../../TESTING.md) explains what each test
layer establishes. The onboarding work owns the full wizard;
@build-agent-control owns conversation control and terminal-history behavior.

## Acceptance Criteria

- [x] Native Pi gate and browser direct-route/unknown-state flow are implemented
  without granting normal workspace, history or control access on missing or
  uncertain Pi state.
- [x] Session-bound attempt and recovery boundaries pass production-bundle
  synthetic browser, disposable distinct-UID and clean-tree CI checks, with
  limitations recorded in [result.md](result.md).

The test-host, real provider and second-person observations are **not** checked
here; their explicit pending checklist is @verify-live-pi-journey.

## Resolution

### 2026-09-30T12:07:53Z · @pi

Native Pi gate and browser direct-route implementation passed the clean gate and focused synthetic/UID tests; test-host and real-provider acceptance is tracked separately in @verify-live-pi-journey.
