---
created: 2026-11-21
updated: 2026-11-21
type: feature
status: untriaged
priority: normal
provenance: other
provenance_detail: ADR 0038 implementation (technical decision run)
source_ref: taskfleet:01m7ys433k48ngv5prdxv58f4e/adr-0038-implementation:browser
originating_run: 01m7ys433k48ngv5prdxv58f4e
originating_run_kind: technical-decision
preparation: pending
related: ['@multiplayer-conversations']
---

# Multiplayer: owner card and participant strip in the browser

## Description

Implements the browser side of ADR 0038 (`docs/decisions/adr-0038-multiplayer-conversations.md`) from the prototype rounds `design-system/prototypes/rounds/2026-11-21-multiplayer-owner/` and `.../2026-11-21-multiplayer-guest/`, as Jari chose on 21.11.: the owner sees the card, the participant the strip.

- Owner: the card where the agent stopped (Salli kaikki, Hyväksy yksitellen with per-call rows showing the full arguments, Älä salli), older waiting requests staying open, the people row and its panel (Täydet oikeudet with a confirmation naming what is lent, take away, remove), Kutsu with the same-server picker, Habitat lines.
- Participant: the strip above the composer with the mode and waiting actions, the invite under Jaettu kanssasi (nothing shown before joining; Liity / Ei nyt), attribution, a stop control on any turn, unavailable/removed states.
- One per-person colour family chosen from the two the rounds used.
- The browser never infers the mode; everything comes from the daemon's facts.
