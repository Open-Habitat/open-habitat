---
created: 2026-11-01
updated: 2026-11-01
type: task
reporter: jari
status: done
priority: normal
lane: proto-view-offer-card
lane_seq: 1
preparation: pending
closed: 2026-11-01
closed_by: conductor
---

# Prototype: the view card an agent offers in a conversation

Jari 1.11., looking at view cards in his conversation: *Avaa* and *Avaa omalle välilehdelle* are good. Everything else needs rethinking:
- *Avaus pyydetty. Jos välilehteä ei näy, selain saattoi estää sen.* shows on every card. Remove it entirely; the card should not request opening on its own. The box itself is enough.
- *Agentti tarjoaa näytettäväksi:* is redundant.
- The title is the file name (`raide.html`). It should be a good descriptive title (agents can already pass `--title`; `agent-view-offer-title` makes them do it).
- *Jäädytetty HTML · 1 tiedosto · 219 kt · Vain sinulle* reads cluttered: *Jäädytetty HTML* sounds odd to an ordinary person, file count and size are needless detail, and *Vain sinulle* could be a sharing/visibility control or state instead of a text.
Prototype the card (`web/src/components/ViewOffer.tsx` today) in production context in a conversation: baseline as on main plus 2–3 directions on one axis, desktop and phone, light and dark, with sharing state where the site allows link sharing, Finnish texts.

## Resolution

### 2026-11-01T07:16:10Z · @conductor

Jari 1.11.: direction 3, riffed in proto-view-offer-card-r2.
