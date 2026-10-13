# Fast clean gate result

The browser host has a process-wide scenario, clock, OAuth admission bucket and
fake Pi state. Namespacing only the scenario would leave the other state shared.
Playwright now starts a fresh Go TLS host for each active case, using its
worker slot's `OH_PORT_BASE + 20 + parallelIndex` port; each host creates
private invented homes and Unix sockets. This also prevents leftover fixture
history or scenarios from contaminating the next case on the same slot. The lab
manual lab remains a separate single-host run at base + 1; the Playwright lab
suite uses four case-isolated lab-mode hosts at base + 40 through base + 43.
Both suites may distribute tests within a spec across workers without sharing
state. The default suite still selects all 142 cases and the lab config
still selects its full lab suite.

Browser and Go/contracts reuse is deliberately limited to an **identical committed tree**
with an already-valid complete clean-gate receipt. A changed tree, including
metadata or documentation, runs both phases in full. The gate rechecks cleanliness
at entry and exit and records the current tree even on reuse. The receipt has a
`reused_phases` list and the original phase-evidence timestamp, while its
existing schema, gate and gate_inputs fields
remain compatible with the release operator. We did not add source-only phase
hashes because the contracts validators, VM self-test, Storybook and Go tests
also read scripts, fixtures and configuration; a smaller hash would require a
maintained dependency inventory and could silently misattribute evidence.
`--no-reuse` forces a full rerun on the same tree. Both the receipt and stdout
JSON expose `reused_phases`, so a repeated pass is not mistaken for fresh
browser or Go coverage.

A focused diff review (Claude Fable 5.1, with local checks) found that the
original JSON omitted reuse, that there was no explicit force-run option, and
that host-build paths assumed the invocation directory. These were repaired.
It also pointed out a hard-kill cleanup gap; each host now records its own
marker and global teardown sweeps owned private directories if a host cannot
shut down cleanly. The reviewer did not find a defect in port allocation or
the tree-keyed receipt check. The review preceded the switch to per-case hosts,
which was driven by the two failed clean runs rather than by speculation.

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
suites. Gate times follow after validation.
