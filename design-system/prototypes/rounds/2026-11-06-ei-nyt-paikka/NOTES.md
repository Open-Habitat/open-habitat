# Sinun vuorosi ↔ Hiljaiset – kierros 2: Ei nyt -painikkeen paikka

Issue `proto-quiet-transition-triggers`. Jari valitsi kierroksen 1 jälkeen
6.11. lähtökohdaksi **A Vastaus**: keskustelu pysyy Sinun vuorosissa,
kunnes vastaat, ja avaaminen vain muuttaa pallon renkaaksi. Tämä kierros
riffaa, missä on painike, joka pudottaa keskustelun Hiljaisiin (*Ei nyt*).
Edellinen kierros on `../2026-11-06-hiljaisiin-siirtyminen/`.

Rakennettu tuotannon komponenteista (`AppShell`, `WorkspaceRail`,
`AgentNavItem`, `WorkspaceNavRow`, `AgentHeader`, `NextWaitingRow`,
`ConversationTimeline`, `UserMessage`, `AssistantMessage`,
`ControlButton`, `TooltipButton`, `Composer` Sanele-painikkeineen).
Kierroksen painikkeet viedään portaalilla tuotannon kentän riville ja
sivupalkin rivin painikeryhmään. Kierroksen omia ovat renkaaksi muuttuva
pallo, nostetun nuoli, vastauksen alle tuleva rivi ja oletusnäkymän
näytetty vihje. Kaikki on synteettistä.

## Yhteistä kaikille suunnille

- **Nosto on kuten päätetty** (`proto-raise-quiet-to-your-turn` kierros 3,
  toteutus `raise-to-your-turn-button`): Hiljaisten keskustelun kentän
  rivin keskipaikalla on *Nosta* ⤒ ja sivupalkin rivillä ⤒.
- **Ei nyt on yksi toiminto** kaikille Sinun vuorosi -keskusteluille: luetulle
  vastaukselle (rengas) ja nostetulle (nuoli). Se vie keskustelun
  Hiljaisiin, kunnes agentti vastaa uudelleen. Nosto ja Ei nyt ovat siis
  saman merkin kaksi suuntaa, kuten kierroksessa 1 suositeltiin.
- Avaaminen ei kuittaa: uusi vastaus (täysi pallo) muuttuu avattaessa
  renkaaksi (*Luettu · odottaa vastaustasi*) ja pysyy Sinun vuorosissa.
  Lähettäminen vie keskustelun Käynnissä-osioon; agentin vastaus tulee 2,5 s
  päästä ja tuo sen takaisin Sinun vuorosiin (avoimena renkaana).
- Ei nyt -painike näkyy vain, kun keskustelu on Sinun vuorosissa eikä
  agentti työskentele.

## Suunnat

Akseli: missä Ei nyt -painike on.

- **Nyt**: avaaminen siirtää keskustelun heti Hiljaisiin. Ei nyt -painiketta ei tarvita, eikä Hiljaisista voi nostaa.
- **A Kenttä**: Ei nyt on kentän rivin keskipaikalla, samassa kohdassa kuin Hiljaisten keskustelun Nosta: yksi painike, kaksi tilaa.
- **B Sivupalkki**: Ei nyt on Sinun vuorosi -rivillä ⤓-painikkeena kynän ja arkiston vieressä, kuten ⤒ Hiljaisten rivillä; avaamatta.
- **C Vastaus**: Ei nyt on agentin viimeisen vastauksen alla rivillä Odottaa vastaustasi; se katoaa, kun vastaat.

Oletusnäkymä on auki oleva *NDA-viestin tarkistus*, jonka uusi vastaus on
juuri nähty: se on Sinun vuorosissa renkaana, ja Ei nyt -painikkeen vihje
näkyy suunnan paikassa, kunnes sivua painetaan ensimmäisen kerran. B:ssä
työpöydän oletusnäkymä näyttää avoimen rivin painikkeet kuin osoitin olisi
rivin päällä.

## Mitä kussakin tapahtuu

- **A.** Keskipaikan pilleri vaihtaa tilaa: Hiljaisissa *Nosta* ⤒, Sinun
  vuorosissa oranssi *Ei nyt* ⤓. Painallus vaihtaa toiseen samassa
  kohdassa. Nostetun keskustelun painike on myös *Ei nyt*. Kierroksen 3
  *Sinun vuorossasi ✕* korvautuu sillä, jotta nimi on sama riippumatta siitä,
  miksi keskustelu on Sinun vuorosissa. Puhelimessa pilleri saa nimen kuten
  Ohjaa. Sivupalkin Sinun vuorosi -riveillä ei ole Ei nyt -painiketta.
- **B.** Sinun vuorosi -rivillä on ⤓ kynän ja arkiston vieressä
  (työpöydällä osoittimen alla, puhelimessa aina näkyvissä), joten
  keskustelun voi pudottaa avaamatta ja useamman peräkkäin. Kentän
  keskipaikalla on vain Nosta; Sinun vuorosi -keskustelun kentän rivi on
  tyhjä kuten tänään. Puhelimessa avoimesta keskustelusta pudottaminen
  vaatii sivupalkin avaamisen.
- **C.** Agentin viimeisen vastauksen alla on rivi *Odottaa vastaustasi ·
  Ei nyt* (nostetussa *Nostit tämän Sinun vuoroosi · Ei nyt*). Rivi
  kertoo tilan siinä, mitä luet, ja katoaa, kun vastaat. Kentän keskipaikalla
  on vain Nosta, joten noston jälkeen painike siirtyy kentän riviltä
  vastauksen alle.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-06-ei-nyt-paikka/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-ei-nyt-paikka/check.mjs \
  design-system/prototypes/dist/ei-nyt-paikka/offline.html <kuvahakemisto>
```

`check.mjs` käy Nyt-tilan ja jokaisen suunnan läpi vaaleana ja tummana,
1440 px osoittimella ja 390 px kosketuksella: oletusnäkymä (puhelimessa
myös sivupalkki), Ei nyt (Hiljaisiin, keskipaikalle tulee Nosta), uudelleen
nostettu (Ei nyt palaa paikalleen), toisen uuden vastauksen avaaminen
(rengas, pysyy), vastaaminen ja agentin vastaus, joka tuo sen takaisin,
sekä sivupalkin ⤒ avaamatta (B:ssä myös ⤓ avaamatta). 382
tarkistuspistettä, konsoli puhdas, kuvat kertoimella 2, etuliite `k2-`.
`index.html` on sama ilman upotettuja fontteja glasspadia varten.

Toteutus tarvitsee A:ssa `Composer`in keskipaikan (sama kuin noston),
B:ssä `AgentNavItem`in painikeryhmään saman paikan kuin noston ⤒ ja C:ssä
`ConversationTimeline`in viimeisen vastauksen alle paikan.
