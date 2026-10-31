---
created: 2026-10-31
updated: 2026-10-31
type: bug
reporter: jari
status: open
priority: normal
lane: settings-shell
lane_seq: 1
preparation: ready
---

# Settings close X floats over scrolled content on long pages

## Description

## Description

Jari 30.10. (testikone pilot.536, työpöytä): Kokeellisten ominaisuuksien sivu on hyvin pitkä, ja vieritettäessä sisältö kulkee oikean yläkulman sulkemisen X:n alta, joten X jää tekstin päälle (kuvassa *Workerin työ rivillä* -kortin *Mitä näkyy* -tekstin kohdalla). Samassa kuvassa *Sanelupalkki*-kortin esikatselussa *Enter valmis* ja *✓ Valmis* -painike olivat päällekkäin; kortti poistuu, kun sanelupalkki tulee oletukseksi (`dictation-bar-default`).

## Acceptance Criteria

- [ ] Sulkemisen X ei koskaan peitä sisältöä millään asetussivulla (esim. oma otsakealue tai varattu tila), työpöytä ja puhelin; selainspec pitkällä sivulla.
