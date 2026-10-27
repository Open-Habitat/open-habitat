---
created: 2026-10-27
updated: 2026-10-27
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: kokeiltavaa:2026-10-26/recap-card-not-shown
lane: recap
preparation: ready
lane_seq: 1
---

# Recap card did not appear at all on the test server (pilot.421)

## Description

Testihavainto, kirjattu KOKEILTAVAA.md:stä 2026-10-27:

Tilannekatsaus ei ilmesty lainkaan (0.0.0-pilot.421, 26.10.): Jarin testikeskustelussa (open-habitat-työtila) katsausta ei tullut näkyviin useiden vuorojen jälkeen, joten `recap-card-labels`-kohdan muutoksia ei voinut kokeilla. Selvitettävä, syntyykö katsaus lainkaan ja jääkö se vain näyttämättä (Jari).

## Comments

### 2026-10-27T06:38:09Z · @claude

Not found from code while fixing recap-appears-while-typing; the earlier behaviour could not have hidden a generated recap (the card showed regardless of the composer). Where generation can fail without any trace, for whoever checks the test server: `recap-extension.mjs` returns silently when no available model has both `cost` and configured auth, when `ctx.modelRegistry.complete` throws or ends with `stopReason` other than `stop` (160 max tokens), or when the reply has no parseable JSON; the daemon's `generateRecap` returns false when `get_commands` lacks the recap command, and it makes at most one automatic attempt per native message (`recapAttemptedThrough`), so one silent failure means no automatic recap until the next message. Next step: on pilot.421's Pi session JSONL, check whether any `conversation-recap` custom entry exists, then try the card's manual request and see whether it reports failure.
