---
created: 2026-10-06
updated: 2026-10-06
type: task
status: open
priority: normal
lane: admission
lane_seq: 20
---

# Open the test installation to anyone with a GitHub account

# Open the test installation to anyone with a GitHub account

## Decision

Jari decided on 6 October 2026 that the **test installation** is open to
anyone who finds its address: the Cloudflare Access email gate is removed, and
anyone who signs in with any GitHub account gets their own Unix account and
workspaces there. The email gate was only a nuisance and the address is not
published. This applies to the test installation only; production admission
keeps its own design.

Jari accepted the consequence: a stranger who finds the address can create an
account and run agents and commands on the disposable test VM. Separation
between people still comes from Unix accounts; nothing here weakens that
boundary.

## Work

After @plan-second-user-admission has landed (allowlist-free broker admission
behind a verified Access assertion):

- Remove the Cloudflare Access application or policy in front of the test
  installation, through Fleetrepo's private test-installation configuration.
- Turn off the gateway's Access assertion verifier (`oauth.access`) on the
  test host at the same time, so sign-in does not fail closed for lack of an
  assertion. Keep the verifier code; only the test installation's config
  changes.
- Keep allowlist-free broker admission. Record in ADR 0004 (or the ADR that
  amended it) that the test installation runs without any admission gate
  beyond GitHub sign-in, and why.
- Verify live: an unauthenticated request reaches the GitHub sign-in without
  an email step, a fresh synthetic or real GitHub sign-in gets its own account,
  and existing users keep their accounts.

## Acceptance Criteria

- [ ] The test installation's address opens the GitHub sign-in without a Cloudflare email step.
- [ ] Any GitHub account can sign in and gets its own Unix account; existing accounts are unaffected.
- [ ] The decision and its scope (test installation only) are recorded in the ADR log.
