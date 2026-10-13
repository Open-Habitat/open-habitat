# Fast clean gate result

The browser host has a process-wide scenario, clock, OAuth admission bucket and
fake Pi state. Namespacing only the scenario would leave the other state shared.
Playwright now starts one Go TLS host per worker slot on
`OH_PORT_BASE + 20 + parallelIndex`; every host creates private invented homes
and Unix sockets. The lab remains a separate single-host run at base + 1.
The suite may distribute individual tests within a spec across workers without
sharing state. The default suite still selects all 142 cases and the lab config
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

## Measurements and checks

With `OH_PORT_BASE=14200`, eight workers ran all 142 browser cases: an initial
file-parallel run took 151.10 s; two full case-level parallel repetitions took
84 s and 89 s. All three passed 142/142 with no excluded cases. Browser assets
were freshly built for the first run; the next two used those unchanged assets.
The gate also runs the separate lab suite. Committed-tree gate times follow
after validation.
