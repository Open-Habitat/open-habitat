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
authority and operation; the dated restrictions below describe the old
installation. The test VM's accounts and data are disposable. Other people's
sessions, household services and infrastructure outside that VM are not.
Synthetic identities keep isolation testing independent of real people;
real-provider sign-in requires their participation and is a separate claim.

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

## Decisions

### 2026-09-25T05:17:13Z · @jari

2026-09-24: Accept incremental delivery of the test harness and measured failures as explicitly bounded evidence. A partial JIT guest fixture may be harvested into a separate reviewed, green intermediate change without claiming that full first-login isolation passed or closing this issue. Keep the observed 2-second ensure timeout and pending account journal as failure evidence; do not silently clear it, weaken authorization or activate a host. Require each intermediate deliverable to pass its own relevant tests and clean-tree CI, label unproven scenarios plainly, and continue the full JIT proof separately. Do not discard preserved worker branches until useful work has been compared/harvested and cleanup is explicitly approved.

### 2026-09-25T10:41:43Z · @jari

2026-09-25: Do not keep expanding a large automated reboot harness. Let the already-running bounded subprocess/guest diagnostic finish (it has now landed as diagnostic only), then use a straightforward operator-observed reboot smoke instead: after a safe install on the isolated test server, reboot it and directly check real service state, login and per-UID routing/ACL cross-user denial. Record what was observed, including failure, rather than inventing synthetic acceptance. This does NOT authorize reboot of the currently installed old disabled host, new deployment, real credentials, open ingress, or waiver of host-key, identity and safety gates. Reboot success on old software would prove nothing about new JIT code; manual proof belongs after authorized installation. Keep this issue open until all accepted evidence, including remaining parallel/fault behavior, is honestly addressed.
