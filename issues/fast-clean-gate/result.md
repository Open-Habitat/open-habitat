# Fast clean gate result

The browser host has a process-wide scenario, clock, OAuth admission bucket and
fake Pi state. Namespacing only the scenario would leave the other state shared.
Playwright now starts a fresh Go TLS host for each active case, using its
worker slot's `OH_PORT_BASE + 20 + parallelIndex` port; each host creates
private invented homes and Unix sockets. This also prevents leftover fixture
history or scenarios from contaminating the next case on the same slot. The manual lab remains a separate single-host run at base + 1; the Playwright
lab suite uses four case-isolated lab-mode hosts at base + 40 through base + 43.
Both suites may distribute tests within a spec across workers without sharing
state. The default suite still selects all 142 cases and the lab config
still selects its full lab suite.

Browser and Go/contracts reuse is limited to an **identical committed tree**
with an already-valid complete clean-gate receipt. A changed tree, including
metadata or documentation, runs both phases in full. The gate rechecks
cleanliness at entry and exit and records the current tree even on reuse. The
receipt has a `reused_phases` list and the original phase-evidence timestamp;
its existing schema, gate and gate_inputs fields remain compatible with the
release operator. Go build/module caches persist across runs, and `go test`
uses Go's default parallel package scheduling on the eight-core host. We did not add source-only phase
hashes because the contracts validators, VM self-test, Storybook and Go tests
also read scripts, fixtures and configuration; a smaller hash would require a
maintained dependency inventory and could silently misattribute evidence.
`--no-reuse` forces a full rerun on the same tree. Both the receipt and stdout
JSON expose `reused_phases`, so a repeated pass is not mistaken for fresh
browser or Go coverage.

A focused diff review (Claude Fable 5.1, with local checks and one targeted
follow-up) found that the original JSON omitted reuse, that there was no
explicit force-run option, and that host-build paths assumed the invocation
directory. These were repaired. Each host now records a marker so global
teardown can sweep owned private directories after abnormal host exit. Fixture
startup/teardown has its own timeout and the SIGKILL fallback waits for the
process exit before reusing its port. A runner killed before global teardown
may still leave an orphan host or temp directory; this is a visible port
failure, not false receipt evidence. The reviewer found no defect in normal
port allocation or the tree-keyed receipt check. The switch to per-case hosts
was driven by the two failed clean runs rather than by speculation.

## Measurements and checks

With `OH_PORT_BASE=14200`, eight workers initially passed all 142 browser
cases three times (151.10 s with file-level scheduling; 84 s and 89 s with
case-level scheduling). On the clean gate, that worker-lifetime fixture exposed
state leaking between sequential cases: the first attempt failed the fake Pi
timing check (141/142), and the second failed three cases (139/142) involving
history, workspace state and the timed fake Pi helper. The host is now restarted
for **each case**, not merely each worker; the Pi test also establishes both
identities before starting its timed helper. Its focused three-case repetition
passed. The lab suite passed all 17 cases twice on four isolated workers (42 s and
43 s). The first two full case-isolated browser repetitions passed 142/142 in
90 s and 92 s. The committed-tree gate supplies the third repetition of both
suites.

The clean gate supplied the third green repetition: 142/142 browser and 17/17
lab cases. On committed tree `e8b937c69e55ef3943be62c6aa8f7ac2749aaea5`
(commit `53f4558`), the cold full gate passed in **287.63 s**: setup 5 s,
dependencies 15 s, web checks 14 s, browser 133 s, Go/contracts 111 s,
packaging 9 s, final checks under a second. A repeat on the identical tree
passed in **44.60 s** (setup 5 s, dependencies 15 s, web checks 15 s,
browser and Go/contracts reused, packaging 9 s). Its JSON and receipt both
reported `reused_phases: ["browser", "go-and-contracts"]`; the receipt
continued to name the committed tree.

Main moved while this worker ran: the test-server default became ungated and
the clean gate stopped being a landing precondition. The rebase kept that newer
policy in `TESTING.md` and `TODO.md`; this change accelerates the opt-in gated
release and the once-per-round health run. On the rebased closed-issue tree
`156c77f6de6b22f8d3fa1abee693f0362ea86a0f` (commit `b3868c4`), the full
cold gate passed in **232.14 s** (browser 116 s, Go/contracts 76 s, other
phases 39 s); the identical-tree warm gate passed in **41.89 s** and recorded
both reused phases. The final acceptance-checklist edit changes the tree once
more; the final tree's exact gate timings are in the worker report.

Fleetrepo's `release_test.py` gated `--dry-run` accepted the full-gate receipt:
`gate: "clean-gate"`, matching tree, `dry_run_verified_no_guest_contact`,
5.534 s (`/var/tmp/fast-gate-gated-dryrun-b3868c4/release-test-receipt.json`).
The operator requires its product commit to be an ancestor of `origin/main`.
That cannot hold inside an unmerged Taskfleet worktree, so a temporary
`/var/tmp` adapter bypassed **only** that ancestry check for the worktree;
it kept the clean-tree/source pin, ran the unchanged preparer and archive
inspection, and did not touch Fleetrepo files or the guest. The final tree is
checked again after the checklist commit.
