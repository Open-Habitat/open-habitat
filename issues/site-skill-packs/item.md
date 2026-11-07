---
created: 2026-11-07
updated: 2026-11-07
type: feature
reporter: jari
status: open
priority: normal
preparation: pending
---

# Site-wide skill packs declared by the administrator

## Description

Jari 7.11.2026 (harkintaan, ei vielä toteutusta): ylläpitäjä voisi ilmoittaa
sivuston asetuksissa skillipaketteja, jotka tulevat kaikkien tilien agenteille,
samaan tapaan kuin Habitat jo jakaa `open-habitat-ui`- ja aloitussivutaidon.
Hyödyllinen Northwindille ja Contosoille (yrityksen omat taidot kaikille).

Kapellimestarin luonnos keskusteluun (7.11.):

- **Nykyinen mekanismi:** daemon antaa Pi:lle käynnistyksessä `--skill`-polut
  (`internal/daemon/recap_linux.go`), ja Taskfleetin taidot tulevat
  laajennuksena, joka tarjoaa ne henkilön ja projektin omien taitojen takana
  (samanniminen oma taito voittaa). Sivuston paketit sopisivat samaan
  kohtaan alimmalla etusijalla.
- **Missä paketit asuvat:** rootin omistamassa, kaikille luettavassa
  hakemistossa (esim. `/opt/open-habitat/skill-packs/<paketti>/<versio>`), ei
  kopioina koteihin: yksi totuus, ei ajautumista, päivitys vaihtamalla
  kiinnitystä.
- **Mistä ne tulevat:** git-repo ja kiinnitetty commit/tagi (tai julkaisuarkisto
  tiivisteineen). Ylläpitäjä vaihtaa version tietoisesti, joten taitojen
  sisältö ei muutu ihmisten alla.
- **Valtuus:** kuten keskustelurajassa: gateway tarkistaa ylläpitäjän, root
  kirjoittaa sivuston asetuksen, ja hakeminen tapahtuu host applyn tai rootin
  ajastimen kautta; daemon vain lukee. Yksityisen repon lukutunnus olisi
  rootin hallussa oleva sivuston salaisuus: päätettävä.
- **Ylläpitäjän näkymä:** palvelinalueen osio *Taidot*: paketit, versio,
  mitä taitoja kussakin on, päivitä/poista. Henkilö näkee asetuksissaan
  sivuston taidot ja voi halutessaan ottaa paketin pois omalta tililtään.
- **Avoimet kysymykset:** riittääkö *kaikille*, vai tarvitaanko ryhmäkohtaisuus;
  saavatko terminaalista käynnistetyt Pi:t samat taidot (runtimen `pi`-käynnistin
  kuten Taskfleetin taidot); git-kiinnitys vai selaimessa ladattava arkisto.

## Acceptance Criteria

- [ ] suunnittelu sovittu Jarin kanssa (malli, valtuus, ylläpitäjän näkymä); sen jälkeen prototyyppi- ja toteutusissuet
