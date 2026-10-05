---
created: 2026-09-24
updated: 2026-10-05
type: task
status: open
priority: high
lane: auth-guest
lane_seq: 10
collision: [scripts/vm-test.sh]
blocked_by: ['@native-gh-jit-handoff', '@implement-linux-executor']
preparation: pending
---

# Prove JIT two-user isolation in private guest

## Purpose and established evidence

Establish that approved GitHub first login binds each person to the right Unix
account, and that their browser, daemon and native processes cannot reach
another person's files, credentials or socket.

The [evidence summary](result.md) records the synthetic guest observations,
tested revisions and limits, including first-login isolation and broker-crash
refusal. The precreated-user baseline is distinct from first-login proof.

## Remaining observation

Observe isolation between two bound users after a real test-server reboot:
service state, login, per-user routing and cross-user home/socket denial.
Jari chose a straightforward operator-observed smoke instead of further
automated reboot-harness work. Fleetrepo's 29 September check
had zero bindings, so it could not establish this property.

Fleetrepo owns the installation, private host details and reboot receipt. Its
`infra/native-agent-host-test/RELEASE-UPGRADE.md` describes current deployment
authority and operation. The test VM's accounts and data are disposable. Other people's
sessions, household services and infrastructure outside that VM are not.
Use simulated GitHub responses and two synthetic identities for this proof.
The existing `test/vm/fake-provider.py` supplies token exchange and user
identity responses; the guest fixtures also simulate native `gh` operations.
Reuse those boundaries as appropriate, keeping the gateway, provisioning
broker, daemons, Unix accounts, filesystem/socket permissions and reboot real.
Create the two bindings through the login path before reboot, then exercise
login and isolation again afterwards. Precreated accounts or a simulated
reboot would miss the property this observation is meant to establish.

This simulation is sufficient for this issue's isolation claim. It does not
establish compatibility with the live GitHub service or real `gh` behavior
where `gh` is simulated. Keep the simulation inside the isolated test
environment; the product's authentication and authorization checks remain
in use.

Completion means the evidence summary establishes this bound-user post-reboot
observation alongside the existing first-login proof. Record the tested
revision, outcomes and limits, referring to Fleetrepo for private evidence. A
failed or unavailable observation leaves a named gap.

## Scope and judgment

Uncertain account state is denied access because adopting an ambiguous account
could cross the Unix-user boundary. The broker-crash refusal has already been
observed; recovery was rejected in @reconcile-interrupted-jit-provisioning.
Clearing a pending marker to obtain a passing test would erase the uncertainty
the test is meant to expose.

Further fault or concurrency work needs a concrete missing security claim or
observed failure. New behavior, such as conversation streams, carries its own
revocation coverage in the implementing issue. Historical receipts describe
their runs, not additional work commitments.

[TESTING.md](../../TESTING.md) defines validation. Security-sensitive fixture
or assertion changes need independent review because a passing negative test
only supports isolation if it would detect an actual breach.
