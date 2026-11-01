---
created: 2026-11-01
updated: 2026-11-01
type: feature
reporter: jari
status: open
priority: normal
lane: decide-view-stable-address
lane_seq: 2
blocked_by: ['@decide-view-stable-address', '@view-address-reservations', '@view-address-publication-lifecycle', '@view-address-entry-route']
preparation: pending
---

# View card: public switch, Kopioi linkki and duration menu

Jari 1.11. accepted the view card from `proto-view-offer-card-r2` riff B and `proto-view-offer-card-r3` riff A: a switch in the title row makes the view public at once, a public card shows *Kopioi linkki*, pressing the expiry date opens a durations menu (the four lengths of the prototype). Republishing starts again from 30 days. No notice when a link has expired, and no sentence about revoking not recalling copies. The card drops *Avaus pyydetty…*, *Agentti tarjoaa näytettäväksi:* and the *Jäädytetty HTML · … · Vain sinulle* line (`proto-view-offer-card`). The address model comes from `decide-view-stable-address`; build on it. Not gated.
