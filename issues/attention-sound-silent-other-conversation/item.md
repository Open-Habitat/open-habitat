---
created: 2026-11-22
updated: 2026-11-22
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-attention-sound
lane: unlaned
preparation: ready
---

# Attention sound does not play when a turn ends in another conversation

## Description

Jari (22.11.2026, test server): the attention sound did not play. Sounds were
on (experimental attention sound enabled, a sound chosen), an agent's turn
ended in one conversation while he was in another conversation, and nothing
was heard.
Next action (defect in agreed behaviour, fix directly).

## Decisions

### 2026-11-22T16:19:38Z · @conductor

Conductor 22.11.2026: likely cause is night quiet tied to device dark mode (worker 01m81zzepmmf43zcg6e0ag8r1j reproduced: preview plays, reply silent; its stronger tests are preserved on wt/g6e0ag8r1j-attention-sound-silent-in-another-co). Jari: the settings must clearly say at the top that sounds are off because it is night — prototype it (attention-sound-night-visible).

### 2026-11-22T16:26:27Z · @jari

Jari 22.11.2026: confirmed — sound works; the silence was night quiet (device dark mode). The visibility fix is attention-sound-night-visible.
