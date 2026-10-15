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

Logs: `/var/tmp/oh-serial-heavy-gate.log` and `/var/tmp/oh-serial-heavy-gate-retry.log` on the test host. First failure: `native-history.spec.ts:70` expected enabled archive control but it stayed disabled for five seconds. Retry failure: `browser-conversation.spec.ts:1485` expected workspace navigation after archive but the conversation query remained for five seconds. These are distinct test failures; neither run reached lab browser tests, packaging, final checks or receipt recording. In both attempts Go/contracts ran to completion **despite** browser failure, showing the pilot preserves separate error reporting. Neither shorter failed wall time is a valid speed comparison. The pilot's two commits were subsequently salvaged onto main (`7a8c0ddc`, `5d9d1362`), with the default still parallel.

## Subsequent passing gates and limits

After preserving the archive and continuation assertions while handling transient native census uncertainty, a no-reuse clean **serial** gate on `5d9d1362` passed in 238 s (browser 148 s, Go/contracts 43 s). A second clean serial gate on the changed tree `0a6423fd` passed in 257 s (browser 163 s, Go/contracts 47 s); this included the cross-user browser identity fix and its outage-account correction. Both issued non-reused receipts. Logs: `/var/tmp/oh-night-serial-main-gate.{jsonl,stderr}` and `/var/tmp/oh-night-gate-outage-security-fixed.{jsonl,stderr}`. These are different trees and variable host loads, not a before/after pair.

On the unchanged `5d9d1362` tree, a default parallel comparator ended at 169 s **failing** the cross-user onboarding browser race; browser and Go/contracts phases each lasted 131 s. On unchanged `0a6423fd`, another parallel comparator with `GOMAXPROCS=2` ended at 237 s **failing** both a lab focus assertion and a Go native continuation census; browser took 190 s, Go/contracts 136 s. Logs: `/var/tmp/oh-night-parallel-main-comparator.{jsonl,stderr}` and `/var/tmp/oh-night-parallel-go2-comparator.{jsonl,stderr}`. Neither failed run proves parallel is faster, and serial has not been shown faster than a *passing* parallel run on the same source tree. Under concurrent host load serial produced valid receipts while these comparators did not; its reliability and performance on an idle runner remain unproven. Keep it opt-in until comparable passing measurements justify a default change. The issue's under-60-second goal remains unmet.
