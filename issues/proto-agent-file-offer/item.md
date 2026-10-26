---
created: 2026-10-26
updated: 2026-10-26
type: task
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-10-26/proto-agent-file-offer
lane: file-offer
lane_seq: 1
preparation: pending
---

# Prototype: agent hands a produced file to the person

## Description

Jari 2026-10-26, keskustelusta toisen kehittäjän kanssa (ulkopuolinen käyttäjä, joka arvioi Habitatia omaan ja asiakkaidensa käyttöön). Agentti tuottaa tiedostoja (PNG-kaaviot, Excel-taulukot, PDF:t, zip), mutta ihmisellä ei ole kunnollista tapaa saada niitä ulos: latauslinkkiä ei ole, ja HTML-näkymä on jäädytetty, hiekkalaatikoitu kopio. Jari: 'Tämä tekoon. Ensin prototyyppaus.'

Prototyyppikierros (design-system/prototypes -menetelmä: 2–3 suuntaa tuotantokontekstissa, työpöytä ja puhelin, vaalea ja tumma, synteettinen data): miten agentin tarjoama tiedosto näkyy keskustelussa (kortti kuten HTML-näkymän tarjous, esikatselu, lataus, useampi tiedosto, vanhentunut tai poistettu tiedosto), ja näytetäänkö agentin tuottama kuva suoraan viestissä. Tutki samalla isäntäpuolen vaihtoehdot ja kirjaa, mitä host-faktoja kukin suunta tarvitsee (esim. open-habitat agent file offer -tyyppinen komento view offerin rinnalle; kopio vai viittaus työtilan tiedostoon; koko- ja tyyppirajat; Content-Disposition attachment). Daemon tarjoaa vain kirjautuneen käyttäjän omia tiedostoja. Jari valitsee; toteutus on agent-file-offer.
