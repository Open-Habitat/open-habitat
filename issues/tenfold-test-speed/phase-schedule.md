# Heavy-phase scheduling pilot

`OH_GATE_SERIAL_HEAVY=1` schedules the existing normal+lab browser phase before the existing Go/contracts phase, after the shared web checks/build. Default scheduling remains concurrent. The browser and Go/contracts jobs retain their checks, separate logs and exit reporting; a browser failure still runs Go/contracts. Reuse, packaging, security/contract checks and clean receipt behavior are unchanged.

## Measurement plan

Run once on a committed clean tree with warm caches: `OH_PORT_BASE=54000 TMPDIR=/var/tmp OH_GATE_SERIAL_HEAVY=1 ./scripts/ci-local.sh --clean --json --no-reuse`. Record revision/tree, host cores and load at start/end, elapsed wall and phase timings, both job statuses and receipt. Compare cautiously to the unchanged-tree `04420f90` passing parallel gate (322 s total, browser 243 s, Go/contracts 212 s overlapping; 8 shared cores, start load ~6–8, near-end ~20–29). Different trees or load make the comparison suggestive, not a stable speedup. Previous parallel failures under load included timeout/native census; a single pilot cannot establish reliability. Never infer distinct-UID isolation from the same-UID browser host.

## Result

Pending committed-tree pilot. The conductor decides whether to repeat and promote scheduling after passing evidence; serial is not the default.
