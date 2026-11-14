---
created: 2026-11-03
updated: 2026-11-14
type: bug
status: duplicate
priority: normal
provenance: agent
source_ref: taskfleet:01m6g1qfd52gxqvzhmjynjysv6/observed:scroll-201-d250
originating_run: 01m6g1qfd52gxqvzhmjynjysv6
originating_run_kind: spinoff
closed: 2026-11-14
---

# lab-conversation-scroll first-turn follow case: stream never grows under reply jitter

## Description

## Description

`web/tests/lab-conversation-scroll.spec.ts:201` ("@lab the first turn is followed before its history is read") fails often under the ordering detector: the poll for the stream to grow past twice the view's height times out after 45 s.

Observed 2026-11-03 on Birch, 2 workers, lab config, `OH_REPLY_DELAY_MS=250 OH_REPLY_SEED=r56-reds`:

- main `4ac5e6a0`: 4/6 and 2/3 failed; without jitter 0/4.
- web/src at `f30e49ab^` (before the one-view change): 3/6. So it is not from that change.
- with `reducedMotion: "no-preference"` for the case: 3/6. So it is not from the reduced-motion default either.

In a failing run the page shows the turn as finished ("Pitkä ajo valmis.") with its work collapsed behind the stage button (130 thoughts · 130 tools · 8 s), although the case opens with `nah:agent-work=visible`. A finished stage is collapsed by design (`AgentTurn`: only the running stage follows the preference), so the stream only grows while the turn runs. In failing runs it apparently never showed the live work tall enough during the ~8 s turn. Unknown: whether the live work rendered at all (the view may have missed the live turn and gone to native history read through the spec's 1.2 s `slowHistory`) or whether the sent message went late. Next step: record frames (`work`, `intro`) in a failing run.

## Resolution

### 2026-11-14T07:30:23Z · @issuectl

Collected into gate-load-flakes-bundle (14.11.2026).
