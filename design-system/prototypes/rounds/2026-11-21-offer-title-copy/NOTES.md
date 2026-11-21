# Tarjotun kohteen otsikon kopiointi – kierros 1

- **Nyt**: koko kortti on yksi painallus, eikä otsikkoa voi valita.
- **1 Valinta**: otsikko on tavallista valittavaa tekstiä (veto, kaksois- ja
  kolmoisklikkaus, puhelimen pitkä painallus). Klikkaus otsikkoon ei avaa
  korttia, muu kortti avaa sen.
- **2 Kopioi**: otsikon viimeisen sanan perässä on tuotannon `CopyButton`.
  Se on levossa himmeä, osoittimen alla ja kohdistettuna selvä ja
  puhelimessa aina selvä.
- **3 Viittaa**: tietorivin lopussa on Viittaa-painike. Se lisää otsikon
  viestikenttään lähettämättä, kuten terminaalin Vie keskusteluun, ja jättää
  kursorin otsikon perään.

Issue `offer-card-title-copy`. Suunnat, suositus ja kysymykset ovat issuen
`result.md`:ssä.

Sivu on tuotannon keskustelu: `ConversationFrame`, `AgentHeader`,
`ConversationTimeline`, `UserMessage`, `AssistantMessage` ja `Composer`.
Neljä tarjousta ovat peräkkäin tuotannon korteilla `ViewOfferCard` ja
`FileOfferCard`: näkymä, CSV pitkällä otsikolla, PDF ja kansio.
Kierroksen omia osia ovat:

- suunnan 1 CSS tuotannon otsikon päällä
- `copy`-käsittelijä, joka poistaa kolmoisklikkauksen jättämän rivinvaihdon
- suuntien 2 ja 3 painikkeet, jotka portaali vie tuotannon kortin sisään
  (`Inside`)
- Viittaan lisäys luonnokseen
- tasattu oikea reuna: vastaukset saavat vuoron koko leveyden kuten
  tuotannossa, ja tarjous jakaa saman palstan (vrt. `offer-card-right-edge`)

Tarkistuspalkissa valitaan teema, kieli ja se, mitä kopiointi antaa: pelkkä
otsikko tai laji ja otsikko (esim. `näkymä ”Retkireitit kartalla – kesä
2026”`). Palkin rivi "Leikepöydällä" näyttää, mitä sivu viimeksi kopioi,
koska tavallisesta http-osoitteesta avatulla sivulla ei ole leikepöytä-API:a
eikä katselija näe leikepöytää. Samat valinnat saa osoitteella:
`?v=1..4`, `?theme=dark|contrast`, `?lang=en` ja `?format=kind`.

## Rakentaminen ja tarkistus

```
node design-system/prototypes/rounds/2026-11-21-offer-title-copy/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 580 \
  node design-system/prototypes/rounds/2026-11-21-offer-title-copy/check.mjs \
  design-system/prototypes/dist/offer-title-copy/offline.html <kuvahakemisto> [--quick]
```

Tarvitset `web/node_modules`-hakemiston lukitiedoston mukaisena
(`npm ci --prefix web`). Tarkistuksen kattavuus on kuvattu `check.mjs`:n
alussa.
