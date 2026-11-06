---
created: 2026-11-06
updated: 2026-11-06
type: feature
reporter: jari
status: done
priority: normal
preparation: ready
provenance: chat
source_ref: chat:2026-11-06/live-conversation-limit-admin
lane: live-limit-admin
lane_seq: 1
closed: 2026-11-06
---

# Administrator sets the concurrent-conversations limit and per-person exceptions (Muisti edellä)

## Description

Jari 6.11.2026: toteutus prototyypistä `proto-live-conversation-limit-setting`
(kierrokset 1–3; viimeisin
`design-system/prototypes/rounds/2026-11-06-samanaikaiset-keskustelut-3/`,
result.md host-tiedot). Ylläpitäjän näkymä **3 Muisti edellä** palvelimen
alueella (`server-settings-own-area`): palvelimen muisti nyt ja arvio, jos
jokainen käyttää koko rajansa; koko asennuksen raja ja henkilökohtaiset
poikkeukset, raja saa nousta yli 32:n (katto 128). Rajaan törmäävä kortti:
Työtiloittain-lista, *Muuta rajaa (ylläpitäjä)* ylläpitäjälle ja harmaa
*Muuta rajaa* muille, *Muokkaa* pois, *Yritä uudelleen* jää. Raja viedään
daemonille rootin kirjoittamana tietona (ei selaimen pyynnössä;
`internal/AGENTS.md`); henkilökohtainen käyttö muiden daemoneista vaatii
lukureitin, jonka valtuus päätetään Jarin kanssa ennen rakentamista, jos
se tarvitaan.

## Acceptance Criteria

- [ ] ylläpitäjä asettaa rajan ja poikkeukset; daemon noudattaa niitä; kortti kuten prototyypissä; testit
