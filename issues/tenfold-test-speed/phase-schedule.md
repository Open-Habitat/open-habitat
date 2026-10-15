# Heavy-phase scheduling pilot

`OH_GATE_SERIAL_HEAVY=1` schedules the existing normal+lab browser phase before the existing Go/contracts phase, after the shared web checks/build. Default scheduling remains concurrent. The browser and Go/contracts jobs retain their checks, separate logs and exit reporting; a browser failure still runs Go/contracts. Reuse, packaging, security/contract checks and clean receipt behavior are unchanged.

## Measurement plan

Run once on a committed clean tree with warm caches: `OH_PORT_BASE=54000 TMPDIR=/var/tmp OH_GATE_SERIAL_HEAVY=1 ./scripts/ci-local.sh --clean --json --no-reuse`. Record revision/tree, host cores and load at start/end, elapsed wall and phase timings, both job statuses and receipt. Compare cautiously to the unchanged-tree `04420f90` passing parallel gate (322 s total, browser 243 s, Go/contracts 212 s overlapping; 8 shared cores, start load ~6–8, near-end ~20–29). Different trees or load make the comparison suggestive, not a stable speedup. Previous parallel failures under load included timeout/native census; a single pilot cannot establish reliability. Never infer distinct-UID isolation from the same-UID browser host.

## Result

On committed `b6665cea31127b473cb77fc9180e42c5bff96b52` (tree `151877590f4b0d360e97040fdd1d658920f0cb1e`), eight logical CPUs, disk-backed `/var/tmp`, port base 54000, warmed checkout caches on the shared host:

| No-reuse clean attempt | Start/end load average (1 min) | Setup | Dependencies | Web checks | Browser | Go/contracts | Wall | Result |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| First | 4.79 / 11.37 (end sampled by runner) | 5 s | 42 s | 14 s | 115 s | 72 s | 248.54 s | Failed: 162 normal passed, 2 capture-only skipped, 1 archive availability assertion failed; Go/contracts passed. |
| One full retry | start not captured (post-first sample 5.51) / 10.94 | 6 s | 14 s | 17 s | 99 s | 46 s | 181.32 s | Failed: 162 normal passed, 2 capture-only skipped, 1 archive navigation assertion failed; Go/contracts passed. |

Logs: `/var/tmp/oh-serial-heavy-gate.log` and `/var/tmp/oh-serial-heavy-gate-retry.log` on the test host. First failure: `native-history.spec.ts:70` expected enabled archive control but it stayed disabled for five seconds. Retry failure: `browser-conversation.spec.ts:1485` expected workspace navigation after archive but the conversation query remained for five seconds. These are distinct test failures; neither run reached lab browser tests, packaging, final checks or receipt recording. In both attempts Go/contracts ran to completion **despite** browser failure, showing the pilot preserves separate error reporting. No clean gate passed, so neither shorter failed wall time can be compared to the 322 s passing parallel baseline as a validated improvement. Reliability is not established. Leave the opt-in branch unmerged for conductor inspection; no further retry or default change is recommended from this evidence.
