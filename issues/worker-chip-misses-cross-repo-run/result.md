# Result

## Cause

Neither the repository nor the restart. Habitat attributed run
01m5w60pxynq08hyrxde3s1dyn to the conversation by its creator session, as it
does for any repository, and the daemon's `/spinoffs` answered 200 with it.
Taskfleet 0.17.1 reported the run's live supervisor as `"state": "dead"`
(`run show` also `stalled: true`): its supervisor identity compares start
times in wall-clock seconds, and Birch's NTP steps moved `/proc/stat` btime
so the recorded start (`supervisor.pid` 1793020944) and the live process's
(1793020921) differed by 23 s. Taskfleet fixed this on its main
(7026d09f, `supervisor-false-pid-recycled`, kernel tick identity); Birch still
runs the 0.17.1 release.

Habitat then classified the pending run as `unknown`, and the closed
Workerit pill gave a mark and a non-idle look only to `working` runs (or
waited ones; the restart had cut the wait). The pill read as idle with 0.

## Fix

The closed pill marks every live spinoff: waited, working without a wait,
or another state (unknown, waiting on its parent) with the muted unknown
dot, and is not idle while any is live. The count "työskentelee" and the
daemon's state classification are unchanged. Tests: `BackgroundStrip.test.tsx`
(unknown run after a cut wait), `spinoffs.spec.ts` (closed pill keeps a
mark for an unknown run), and a daemon test with the observed native record
(Claude, interactive, `~/Sources` repository, supervisor dead).

## Decisions for later review

- An unwaited run in another state now has a mark on the closed pill; the
  Pisteet direction (26.10.) marked only waited or working runs. The issue's
  acceptance needs the run visible, and the muted dot already existed for
  rows. Legend gains "muu tila" when such a mark is shown.
- The daemon still calls a pending run with a dead/unknown supervisor
  `unknown`; whether Habitat should drop that inference is the
  `restart-notice-presentation` question, left to that issue.
- The real remedy for the false "dead" is a Taskfleet release containing
  7026d09f on Birch; no Habitat change works around Taskfleet's wrong claim.

## Checks

Birch: focused web (775 unit), `./internal/daemon` Go, `spinoffs.spec.ts`
(5 passed). Whole browser suite (`OH_PORT_BASE=5274`; another worker held the
default ports): 396 passed, 3 failed in untouched `attachment-documents` and
`browser-editor-concurrent`, both green when rerun alone, so load timing
rather than a defect.
