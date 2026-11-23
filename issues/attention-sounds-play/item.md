---
created: 2026-11-23
updated: 2026-11-23
type: bug
reporter: jari
status: fixed
priority: normal
lane: unlaned
preparation: ready
closed: 2026-11-23
---

# Attention sounds play during night silence

## Observed (Jari 23.11.2026, ~20.45 local time)

Attention sounds play although they are silenced for the night (Asetukset › Äänet,
night quiet hours). Device, browser and which sound (the chosen Habitat sound or the
system notification sound) not yet known; likely the installation on v0.1.6.

## Done when

The cause is found and fixed: no Habitat-originated sound plays during the person's night
hours on any device while night silence is on, or, where a sound is outside Habitat's
control (e.g. an OS notification sound from Web Push), the settings say so truthfully and
Habitat does what it can (silent notifications during night).
