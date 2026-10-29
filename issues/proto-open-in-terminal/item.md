---
created: 2026-10-28
updated: 2026-10-29
type: feature
reporter: conductor
status: done
priority: normal
preparation: pending
provenance: chat
source_ref: chat:2026-10-28/proto-open-in-terminal
lane: proto-open-in-terminal
lane_seq: 1
closed: 2026-10-29
---

# Prototype: open a terminal-started conversation in the browser's terminal

## Description

Konduktorin oma prototyyppikierros 2026-10-28 research-alder-pi-plugins-raportin idean 4 pohjalta: päätteestä (SSH/tmux) käynnistetty Pi-keskustelu näkyy selaimessa vain luettavana; henkilö voisi avata sen selaimen päätepaneeliin (oma tmux-istunto) ja jatkaa siellä, tai nähdä missä se pyörii. Selvitä host-faktat (miten daemon tunnistaa päätteen Pi:n ja sen tmux-paneelin, mitä selaimen pääte jo osaa: web/src, internal/daemon) ja näytä 2–3 suuntaa yhdellä akselilla (design-system/prototypes -menetelmä, tuotantokonteksti keskustelunäkymä ja päätepaneeli, työpöytä ja puhelin, vaalea ja tumma, synteettinen data, yksi offline-tiedosto). Henkilön rajat: vain oma Unix-käyttäjä. Jari valitsee; toteutus on myöhempi issue.

## Decisions

### 2026-10-29T09:47:08Z · @jari

Jari 29.10.: Katso (read-only mirror of the tmux window), as an experimental feature. Choosing Katso accepts crossing the daemon's own PrivateTmp sandbox to reach the person's own tmux socket (decision 5; same Unix user, not a person boundary). The explanatory text has too much information: "Pi kirjoittaa tähän keskusteluun tmux-istunnossa work, ikkunassa 2 pi. Selain näyttää historian vain luettavana. Paneeli näyttää ikkunan sellaisenaan, mutta ei kirjoita siihen." Shorten it. Implementation: terminal-watch-experimental.
