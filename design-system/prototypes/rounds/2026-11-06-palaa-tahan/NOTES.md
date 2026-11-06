# Palaa tähän – kierros 2: tiedostojen palautus

Issue `proto-rewind-conversation`. Jari valitsi 6.11. kierroksen 1
(`rounds/2026-11-03-palaa-aiempaan/`) suunnan **Palaa tähän**: uutta
keskustelua ei synny, vaan korvattu jatko jää saman keskustelun sisään
niin kuin Pi:n `/tree` pitää sen samassa istuntotiedostossa. Tämä kierros
riffaa tiedostojen palautusta. Tutkimus (raine/better-pi-rewind, pi-rewind,
Pi:n `git-checkpoint`-esimerkki, Claude Coden checkpointit) on issuen
`result.md`:ssä.

Rakennettu tuotannon komponenteista (`AppShell`, `WorkspaceRail`,
`NowSections`, `AgentHeader`, `ConversationTimeline`, `UserMessage`,
`AssistantMessage`, `ToolRow`, `Menu`, `Checkbox`, `RadioGroup`, `Button`,
`Composer`). Kierroksen omia ovat vahvistuskortti, tiedostolista, haaran rivi
ja palautuksen rivi. Keskustelu on sama kuin kierroksella 1, mutta
kolmannessa vuorossa agentti ajaa myös komennon
(`python scripts/taulukko.py`), jonka muutoksia tiedostokohtainen checkpoint
ei näe. Mitään ei lähetetä eikä palauteta.

## Ero kierrokseen 1

Oletusnäkymä on sama Palaa tähän -vahvistus viestin alla, mutta siinä on nyt
tiedosto-osa: A nimeää jäävät tiedostot, B:ssä on valinta *Palauta myös
tiedostot*, C:ssä kolmen kohdan valinta. Suunnat B (uusi keskustelu) ja C
(versiot ‹ 1/2 ›) ovat poissa.

## Suunnat

Akseli: kuinka paljon tiedostojen palautusta Palaa tähän tarjoaa.

- **A Vain keskustelu**: Palaa tähän siirtää vain keskustelun; vahvistus nimeää tiedostot, jotka jäävät agentin muuttamiksi (Pi:n /tree sellaisenaan).
- **B Tiedostot mukana**: vahvistuksessa Palauta myös tiedostot, oletuksena päällä; aiemman jatkon rivi kertoo palautuksen, ja jatkon vaihto palauttaa sen tiedostot.
- **C Valitse mitä**: vahvistuksessa keskustelu ja tiedostot, vain keskustelu tai vain tiedostot; tiedostojen palautuksen voi perua.

## Mitä kussakin tapahtuu

Kaikissa sisäänkäynti on oman viestin ⋯ › *Palaa tähän…* (työpöydällä
osoittimen alla, puhelimessa aina näkyvissä), ja vahvistus avautuu viestin
alle. Hyväksynnän jälkeen viesti on kentässä, ja korvattu jatko on rivi
*Aiempi jatko · 2 viestiäsi ja 2 vastausta*. *Näytä* avaa sen himmeänä ja
*Jatka tästä jatkosta* vaihtaa jatkot keskenään. Tämä on Pi:n puu: molemmat
jatkot ovat samassa istunnossa, ja malli näkee vain aktiivisen.

- **A.** Tiedostot jäävät. Vahvistus nimeää ne; jatkon vaihto ei koske
  tiedostoihin (ne ovat jo siinä tilassa, johon aiempi jatko ne jätti).
- **B.** Valinta *Palauta myös tiedostot* on päällä, ja sen alla lista
  tiedostoista, joiden agentin muutokset perutaan (+/−), sekä huomautus
  komennosta, jonka muutoksia ei palauteta. Valinnan pois ottaminen tekee
  vahvistuksesta A:n. Rivi kertoo *3 tiedostoa palautettu*. Jatkon vaihto
  kysyy *Palauta myös sen tiedostot* (oletuksena päällä).
- **C.** Kolme kohtaa: *Keskustelu ja tiedostot* (oletus, kuten B),
  *Vain keskustelu* (kuten A) ja *Vain tiedostot*: keskustelu jatkuu
  ennallaan, loppuun tulee rivi *3 tiedostoa palautettu … agentille
  kerrottiin palautuksesta* ja painike *Peru palautus*.

*Agentti › Työssä* näyttää vahvistuksen, kun vuoro on käynnissä: painike
pysäyttää agentin ensin (*Pysäytä ja palaa*, *Pysäytä, palaa ja palauta*,
*Pysäytä ja palauta tiedostot*). *Alku › Keskustelu* näyttää tavallisen
keskustelun, josta toiminto löytyy.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-06-palaa-tahan/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-palaa-tahan/check.mjs \
  design-system/prototypes/dist/palaa-tahan/offline.html <kuvahakemisto>
```

`check.mjs` käy jokaisen suunnan läpi vaaleana ja tummana, 1440 ja 390 px:
vahvistus, valinnan vaihto (B ilman tiedostoja, C vain tiedostot), tulos,
aiempi jatko, muutetun viestin lähetys ja jatkon vaihto, C:n palautuksen
peruminen, sisäänkäynti viestin ⋯-valikosta ja agentti työssä
(248 tarkistuspistettä, konsoli puhdas, kuvat kertoimella 2).
`index.html` on sama ilman upotettuja fontteja glasspadia varten.

Toteutuksessa viestin otsake tarvitsee paikan omille toiminnoille
(`Message` saa nyt vain kopioinnin); kierros asettaa ⋯:n otsakkeen oikeaan
reunaan omalla tyylillään.
