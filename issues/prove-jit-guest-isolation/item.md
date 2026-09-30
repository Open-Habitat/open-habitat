---
created: 2026-09-24
updated: 2026-09-30
type: task
status: open
priority: high
lane: auth-guest
lane_seq: 10
collision: [scripts/vm-test.sh]
blocked_by: ['@native-gh-jit-handoff', '@implement-linux-executor']
---

# Prove JIT two-user isolation in private guest

## Goal

Show that first approved GitHub login creates the right Unix account and that
one user's browser, daemon or processes cannot reach another user's files,
credentials or socket. Use disposable Linux guests with synthetic identities
so the security boundary can be exercised without involving real people.

## Evidence already obtained

The [evidence summary](result.md) records passing guest runs for newly
allocated UIDs, mapped browser routes, kernel peer and filesystem denial,
repeat login and account-handle changes, simultaneous first-login callbacks,
session revocation, native GitHub failures and selected inconsistent-state
faults. These are results for the recorded revisions and scenarios. The
precreated-user `two-user-routing` baseline is separate from first-login proof.

## Remaining work

The main remaining isolation observation is after a real test-server reboot
with bound users: service state, login, routing and cross-user home/socket
access. Jari chose a straightforward operator-observed smoke instead of
expanding the automated reboot harness. Fleetrepo owns the installation and
its receipt. Its 29 September reboot check had zero bindings, so it does not
satisfy this observation. Test identities and native data need a deliberately
chosen scope; other people's sessions and household services are unrelated.

For interrupted account creation, the required behavior is to deny access
while state is uncertain. In-process tests cover refusal at each journal
phase; an actual broker-process crash during a partially created account has
not been demonstrated in a guest. A bounded check of that refusal remains
useful evidence here. Recovery is a different requirement: Jari rejected a
separate operator-reconciliation project in
@reconcile-interrupted-jit-provisioning. This issue does not require building
recovery or clearing a pending marker to make a test pass.

The recorded concurrency and drift cases already provide bounded evidence.
Further cases should address a concrete missing security claim or observed
failure, rather than an undefined requirement to cover every scheduling order
or every possible drift. New behavior such as conversation event streams
needs its own revocation coverage in the implementing work.

## Acceptance Criteria

- [ ] The evidence summary distinguishes established first-login isolation,
  remaining security observations and the revisions each result covers.
- [ ] Post-reboot isolation with bound users is recorded from the
  operator-observed test-server smoke, with Fleetrepo owning host details.
- [ ] The remaining actual broker-crash refusal observation is addressed
  explicitly; no recovery feature or unbounded fault matrix is implied.

Follow [TESTING.md](../../TESTING.md) for checks appropriate to changes.
Security-sensitive fixture or assertion changes need independent review:
a passing test is useful only if its negative cases really detect a breach.
Historical receipts keep their original scope; they are not instructions to
repeat completed work or to revive superseded recovery and reboot projects.

## Decisions

### 2026-09-25T05:17:13Z · @jari

2026-09-24: Accept incremental delivery of the test harness and measured failures as explicitly bounded evidence. A partial JIT guest fixture may be harvested into a separate reviewed, green intermediate change without claiming that full first-login isolation passed or closing this issue. Keep the observed 2-second ensure timeout and pending account journal as failure evidence; do not silently clear it, weaken authorization or activate a host. Require each intermediate deliverable to pass its own relevant tests and clean-tree CI, label unproven scenarios plainly, and continue the full JIT proof separately. Do not discard preserved worker branches until useful work has been compared/harvested and cleanup is explicitly approved.

### 2026-09-25T10:41:43Z · @jari

2026-09-25: Do not keep expanding a large automated reboot harness. Let the already-running bounded subprocess/guest diagnostic finish (it has now landed as diagnostic only), then use a straightforward operator-observed reboot smoke instead: after a safe install on the isolated test server, reboot it and directly check real service state, login and per-UID routing/ACL cross-user denial. Record what was observed, including failure, rather than inventing synthetic acceptance. This does NOT authorize reboot of the currently installed old disabled host, new deployment, real credentials, open ingress, or waiver of host-key, identity and safety gates. Reboot success on old software would prove nothing about new JIT code; manual proof belongs after authorized installation. Keep this issue open until all accepted evidence, including remaining parallel/fault behavior, is honestly addressed.
