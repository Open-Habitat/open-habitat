---
created: 2026-10-30
updated: 2026-10-30
type: feature
reporter: jari
status: open
priority: normal
lane: experimental
lane_seq: 11
preparation: ready
---

# Next waiting conversations as a queue (Jono)

_Source: chat_

## Description

Implement `proto-next-waiting-navigation` direction **Jono** (Jari 30.10.): the whole round of conversations waiting for the person is shown as a queue bar that is walked step by step, replacing today's Alt+↓/Alt+↑ walk behind the experimental next-waiting row. The prototype (`issues/proto-next-waiting-navigation/prototypes/siirtyma/index.html`), its NOTES.md and result.md are the specification, including the three gaps it found in production (invisible step back, a read reply stalls the walk, no return on phone). Stays behind the existing experimental switch (`next-waiting-row`).

## Acceptance Criteria

- [ ] Queue bar and step walk as in the prototype, desktop and phone, light and dark; the three gaps fixed.
- [ ] No new host endpoint or store unless result.md shows one is needed.
- [ ] Browser spec; KOKEILTAVAA line.
