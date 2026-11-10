# Investigation — 10 November 2026

**Still open; not reproduced and no fix claimed.** Investigated second in run
`01m720vap8bg1vfbbd1y2xyd7z`. The spec remains unchanged.

Birch, umask 077, short disk-backed TMPDIR, two browser workers, port base 16400,
timeout-bounded commands from `web/`:

`npx playwright test tests/rail-groups.spec.ts --repeat-each 6 --trace on`

- D250 seed `sweep-focus-repeat`, source `bb5241c0f`: 12/12 pass.
- Same settings plus CPU4: 12/12 pass. This later run included the rail
  stale-status projection fix for `race-rail-not-now-missing`, so it is not an
  independent unchanged-main reproduction attempt.

The snapshot mock always reapplies parked/aged facts to every snapshot, and
ordinary host changes in the Redux patch log do not patch worker counts.
Therefore the original lead that a later plain host update removes the mocked
worker is not yet proven. A second possibility is that leaving before the turn
settles marks its later reply new: attention puts a parked conversation in
Sinun vuorosi rather than Käynnissä. The first row checks worker-waiting and
age, not settlement/read attention. A follow-up should log both groups and
attention at the failure before choosing a fixture hold/readiness correction.

Disposable logs: `/var/tmp/residuals-groups-{before,cpu}.log`.
No second-seed/default acceptance matrix or live verification claimed. The brief
explicitly permits leaving an unsettled issue open and merging the others;
this issue remains open with its original oracle intact.

## Decisions for later review

No product decision. Do not rewrite the worker fixture or weaken group
membership assertions without a reproduced cause.
