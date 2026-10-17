---
created: 2026-10-17
updated: 2026-10-17
type: improvement
reporter: jari
status: done
priority: high
lane: web
collision: [web/src/app/, web/src/components/]
preparation: ready
closed: 2026-10-17
---

# Model and thinking-level choice is slow; thinking levels are known in advance

Jari, 2026-10-17 ~06.51 (ajattelutaso-odottaa.avif, Asetukset → Agentit): the picker works better now but choices are slow: after picking a model the thinking levels (off … max) stay struck through until the server answers. "Meillä on kuitenkin etukäteen oikeasti tieto mahdollisista ajattelutasovaihtoehdoista, joten niitä ei tarvitse odottaa aina mallin valinnan jälkeen. Nää voisi kaikki tarkastaa jossain vaiheessa valmiiksi." Load every model's thinking levels with the catalog (one read, kept for the identity as `refresh-without-session-reads` already does), enable levels at once on selection, and save the choice optimistically per Jari's mutation classes (default model is in the optimistic class, `browser-mutation-layer`).

## Acceptance Criteria
- [ ] Picking a model enables its thinking levels immediately; the save confirms in the background; a refusal reverts with its reason (browser test).
