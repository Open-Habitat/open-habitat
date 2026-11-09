# Result

## Cause

Round 69 did not cause this. `.ah-next-waiting` has been `display: grid` with an
implicit `auto` column since the strip was introduced (c534aefd8, 2026-10-29).
An auto track grows to the button's min-content, and the button's titles do not
wrap. So once the waiting titles are long enough, the track, and the button
with it, extends past the composer column and the viewport. The lab titles were
short, so no check hit this. Replaying the new check on the tree before
`9881ef7fb` overflows the same way: the button spans 320..1042 at a 1024 px
viewport while the field spans 320..1000. Real pilot titles are long, which is
why every pilot shows it.

## Fix

`grid-template-columns: minmax(0, 1fr)` on `.ah-next-waiting`. The strip stays
inside the column and its titles truncate with an ellipsis. The stack's 9 px
rhythm and order are unchanged.

## Check

`web/tests/lab-composer-stack-gaps.spec.ts` now runs at 1440, 1024, 800 and
390 and uses a waiting title longer than the column. In every state (idle,
waiting, queued, attachment, draft) and in both light and dark, it asserts that
each visible stack part (waiting strip, notices, background badges, queue,
attachment chips) shares the left and right edges of the composer field
(`.ah-cbox`, ±0.5 px) and stays inside the viewport. Before the fix it failed at
1024 (`.ah-next-open` right edge at 1042).

Green with `OH_PORT_BASE=14700`: lab-composer-stack-gaps (4),
next-waiting-row (4), queued-send (14), composer-geometry (4),
lab-composer-area (10); web static/unit checks.

## Evidence

`evidence/{before,after}-{1440,1024,800,390}-{waiting,queued}-{light,dark}.avif`,
device scale factor 2. Capture with `OH_STACK_CAPTURE=after
OH_STACK_CAPTURE_DIR=../issues/next-waiting-strip-overflow/evidence`.

## Decisions for later review

- The capture directory is now `OH_STACK_CAPTURE_DIR` instead of a path
  hard-coded to the closed `composer-stack-gaps-uneven` issue. The alternative
  was another hard-coded issue path, which would go stale when that issue is
  pruned.
- Dark mode is checked by switching `data-theme` within the same test rather
  than running a separate test per theme. Geometry does not depend on the
  theme, so a separate run would cost time and check nothing more.
