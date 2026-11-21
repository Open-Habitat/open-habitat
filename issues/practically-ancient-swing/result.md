# Result

## Cause

The spec, not the scroll-following code, was wrong. Its `idle` waited for the
send button to be in send mode, and the button is in that mode before a turn has
started as well as after it ends. On a fast host `idle` returned right after
"ensimmäinen viesti" was pressed. The spec then pressed send for "toinen viesti"
while the composer was still blocked. The product refuses that press with a
reason and keeps the draft, which is correct, and the next `fill("pitkä ajo")`
overwrote it. So "toinen viesti" was never sent, and the thread was shorter than
the view during the measurement. A conversation started in the view grows down
from its first message (`data-created-here`), so a short thread leaves
100–300 px below its last row by design. The spec read that space as a held gap.
Frame dumps showed `scrollHeight == clientHeight` for the whole wide stretch,
with no `--ah-stream-hold` involved. Under `OH_CPU_THROTTLE=4` the timing hid
the race (20/20 green before the fix).

## Fix

`web/tests/lab-conversation-scroll.spec.ts` helpers, shared by every case in the
file:

- `send` presses only a ready send (`:not([aria-disabled="true"])`) and waits
  for the draft to be taken.
- `idle` waits for the turn's own saved reply from the synthetic Pi, then for
  send mode.
- `settled` replaces the fixed 1000/2500 ms waits. It polls until the thread
  height is stable and no hold is active (this was the existing `tallAtEnd`
  logic, now extracted).
- The spacing case asserts its precondition: the thread fills the view.

## Evidence

`OH_BROWSER_WORKERS=2`, `OH_REPLY_DELAY_MS=60`, lab config, `--workers 2`:

| run | before | after |
| --- | --- | --- |
| `--grep "live row stays" --repeat-each 6` | 1/6 passed | 6/6 |
| `--grep "live row stays" --repeat-each 20` | 13/20 passed | 20/20 |
| same, `OH_CPU_THROTTLE=4` | 20/20 (race hidden) | — |
| whole file `--repeat-each 3` | — | 18/18 |
| whole file `--repeat-each 3`, `OH_CPU_THROTTLE=4` | — | 18/18 |

Logs are in `/var/tmp/agent-keep/test-stability-v4b6/` (`i1-*.log`, and
`frames-*.json` with failing-frame dumps from the unchanged code).
