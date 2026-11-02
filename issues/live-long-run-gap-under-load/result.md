# Result (2.11.)

## The flash is real, and it is not the long-run path

Reproduced on Birch with `live-long-run.spec.ts` alone beside 12–16
busy loops under `timeout`: the notice appeared in most loaded runs, always
for 100–250 ms right as the run started working, never around
`ring_truncated`. Instrumenting the store showed the cause:

1. Creating the conversation makes the daemon emit three
   `snapshot.invalidated` events (`:1`–`:3`).
2. Under load the browser opens the new conversation's view after the
   router has delivered `:3` but while the applied snapshot is still the one
   for `:2`. `ConversationStore.view()` seeds the window with
   `seedLive(snapshotCursor)`, which sees `routed.sequence (3) > 2` and marks
   the window `missed` (logged: `seedLive …:2 routed=3 tail=0`).
3. The first read of a new conversation finds no history (`history_missing`),
   and that does not clear `missed`. Only a read that joins entries does.
4. When the first message is sent, the status becomes `run_active`. The notice
   then shows until the first history read with entries joins, about 180 ms.

None of this depends on the synthetic host. The invalidations come from the
daemon's own event journal, and the fake Pi only adds the run's frames. In real
use, on a loaded host, the first message of a freshly opened conversation can
flash the notice, however long the person spends typing, because nothing
clears the flag while history is missing. On an idle host the window is a few
milliseconds wide, which fits the fact that it has not been seen in real use.
So the spec is right to fail. The product defect it catches is a different one
from the one the spec was written for.

Not fixed, as the brief requires. A likely fix: let a read that is begun after
the miss and confirms the history missing count as the join (nothing native
exists for the missed events to have carried), or do not mark a seed as
missed when the agent's history is still `missing` and its live tail empty.
It changes the conversation store's missed-events rule, so it waits for
Jari's decision.

## What changed in the spec

The spec had a separate load false positive. A starved host throttles the
page's 25 ms timer: under load it collected 15–100 working samples, and the
assertion that there are more than 130 failed, although the run was observed
throughout. The spec now:

- measures the run's span in time: the working samples must span more than
  7 s, since the run is at least 130 × 60 ms long;
- watches the notice with a `MutationObserver`, so an appearance shorter than
  a sample, or one that falls between throttled samples, still fails it. The
  samples remain as the log.

After the change: unloaded 5/5 pass. Under 14 busy loops 5/6 pass, and the one
failure is the seed race above (`gapShown` from 117 ms), so a real flash still
fails the spec.

## Decisions for later review

- Kept the strict "notice never shown" assertion and did not exempt the
  start of the run, although the flash there is not the long-run defect.
  The alternative was to start observing only after the run has been working
  for a while, which would make the gate green but hide a real flash, against
  Jari's first decision that no appearance is acceptable.
- Left the issue open: what remains is the product race, which needs
  Jari's decision before code changes.
