# Nosta Hiljaisista – kierros 3: kentän luona

Issue `proto-raise-quiet-to-your-turn`. Jari päätti kierroksen 2 jälkeen
6.11.: nosto on sekä sivupalkin rivillä että kentän luona. Tämä kierros
riffaa kentän luona olevaa nostoa nykyisen kentän rivin rinnalla: missä
kohdassa riviä nosto on ja miltä rivi silloin näyttää kokonaisuutena, kun
kenttä on tyhjä, kun siihen kirjoitetaan ja kun agentti työskentelee.
Edellinen kierros on `../2026-11-06-nosta-painike/`.

Rakennettu tuotannon komponenteista (`AppShell`, `WorkspaceRail`,
`AgentNavItem`, `WorkspaceNavRow`, `AgentHeader` mallisiruineen,
`NextWaitingRow`, `ConversationTimeline`, `UserMessage`,
`AssistantMessage`, `ControlButton`, `TooltipButton`, `Composer` Sanele-
painikkeineen). Nostopainike viedään portaalilla tuotannon `Composer`in
riville, joten kentän muut painikkeet ovat täsmälleen tuotannon omat.
Kierroksen omia ovat nostopainikkeet, nostetun rivin nuoli ja
oletusnäkymän näytetty vihje. Kaikki on synteettistä.

## Nykyinen rivi, jota vasten riffataan

Olemassa olevan keskustelun kentän rivi tuotannossa:

- levossa: **Liitä · Komennot · Tiedosto** vasemmalla, oikealla
  **Sanele** ja **Lähetä ↑**;
- agentin työskennellessä keskelle syntyvät **Ohjaa** ja **Stop** ja
  erotin; Sanele ja Lähetä pysyvät paikallaan (rivin periaate: mikään,
  mikä on sekä levossa että työssä, ei liiku);
- puhelimessa (≤ 440 px) apupainikkeet ovat pelkkiä kuvakkeita.

Kentässä ei ole mallisirua, paitsi tyhjässä, vasta aloitetussa
keskustelussa. Olemassa olevan keskustelun malli näkyy yläpalkissa
(`gpt-5.5`), kuten tässäkin. Kierroksen 2 B:n mallisiru kentässä ei siis
vastannut tuotantoa. Lähetä piirtää jo ↑:n, joten nosto piirtää tässä
kierroksessa ⤒:n (nuoli palkkiin), ettei kaksi samaa nuolta ole vierekkäin.
Sivupalkin rivin nosto on sama kuin kierroksen 2 C:ssä, mutta samalla
⤒-kuvakkeella, ja nostetun rivin lasku on ⤓.

Nimi *Palaan tähän* on jätetty pois, koska keskustelun kelaus käyttää jo
nimeä *Palaa tähän* (`proto-rewind-conversation`). Painikkeessa lukee
**Nosta**, ja nostettuna **Sinun vuorossasi ✕**.

## Suunnat

Akseli: missä kohdassa kentän riviä nosto on.

- **Nyt**: Hiljaisista ei voi nostaa. Kentän rivillä ovat Liitä, Komennot ja Tiedosto, oikealla Sanele ja Lähetä.
- **A Apuihin**: Nosta on vasemmalla Tiedoston jälkeen, samannäköisenä kuin muut apupainikkeet; agentin työskennellessä se jää paikalleen himmeänä.
- **B Lähetykseen**: kun kenttä on tyhjä, Lähetä-pallon paikalla on nosto ⤒; kun kirjoitat, se on taas Lähetä. Rivi ei kasva yhtään.
- **C Keskelle**: Nosta on oikealla ennen Sanele-painiketta, siinä missä työn aikana ovat Ohjaa ja Stop; työn alkaessa ne tulevat sen tilalle.

Oletusnäkymä on auki oleva Hiljaisten keskustelu *Contosoin tapaaminen*
tyhjällä kentällä, ja nostopainikkeen vihje näkyy, kunnes sivua
painetaan ensimmäisen kerran.

## Yhteistä kaikille suunnille

Nosto itse on kierrosten 1 ja 2 mukainen: nostetun pallon paikalla on
oranssi nuoli, viimeksi nostettu on Sinun vuorosin ja *Sillä aikaa*
-rivin kärjessä, avaaminen ei kuittaa nostoa, ja nosto päättyy, kun
vastaat tai painat samaa painiketta uudelleen. Sivupalkin rivillä on ⤒
kynän ja arkiston rinnalla (työpöydällä osoittimen alla, puhelimessa aina
näkyvissä), joten minkä tahansa Hiljaisten keskustelun voi nostaa
avaamatta. Työssä olevaa tai jo vastauksena odottavaa ei voi nostaa.

## Mitä kussakin tapahtuu

- **A.** Nosta on neljäs apupainike: sama harmaa tyyli, työpöydällä
  nimellä, puhelimessa pelkkä ⤒ kuten Liitä, Komennot ja Tiedosto.
  Nostettuna se on oranssi *Sinun vuorossasi ✕* (puhelimessa oranssi ⤒).
  Agentin työskennellessä se jää paikalleen himmeänä, ja vihje kertoo
  syyn, joten vasen puoli ei muutu työn alkaessa. Puhelimessa työn
  aikainen rivi on täysin: neljä kuvaketta, Ohjaa, Stop, Sanele, Lähetä.
- **B.** Tyhjällä kentällä Lähetä on nyt harmaa eikä tee mitään; B antaa
  sen paikan nostolle. Levossa pallo on ääriviivallinen ⤒, nostettuna
  täytetty oranssi, ja painallus laskee. Kun kenttään kirjoittaa, pallo on
  taas Lähetä ↑. Työn aikana pallo on Lähetä/Ohjaa kuten nyt. Rivi ei
  kasva missään tilassa, mutta nostosta ei näe mitään sillä välin, kun
  kentässä on tekstiä.
- **C.** Nosta on samannäköinen pilleri kuin työn aikainen Ohjaa ja on
  samassa keskipaikassa ennen erotinta. Levossa paikka on nostolle, työssä
  Ohjaa ja Stop; nostoa ei voi tehdä työn aikana, joten mitään ei katoa,
  mitä voisi käyttää. Puhelimessa pillerissä on nimi kuten Ohjaassakin.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-06-nosta-kentan-luona/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-nosta-kentan-luona/check.mjs \
  design-system/prototypes/dist/nosta-kentan-luona/offline.html <kuvahakemisto>
```

`check.mjs` käy Nyt-tilan ja jokaisen suunnan läpi vaaleana ja tummana,
1440 px osoittimella ja 390 px kosketuksella: oletusnäkymä (puhelimessa
myös sivupalkki), nosto kentän painikkeella, luonnos kentässä, rivi
agentin työskennellessä (*Kesäajan virhe*), *Sillä aikaa* -rivi nostettu
kärjessä, avaaminen sieltä (nosto pysyy), lasku samalla painikkeella,
toisen keskustelun nosto sivupalkista avaamatta ja vastaaminen nostettuun
(424 tarkistuspistettä, konsoli puhdas, kuvat kertoimella 2, etuliite
`r3-`). `index.html` on sama ilman upotettuja fontteja glasspadia varten.

Toteutus tarvitsee `Composer`iin paikan: A:ssa apupainikkeiden perään
(`.ah-crow-lz`), B:ssä Lähetä-painikkeen vaihtoehdoksi tyhjällä kentällä,
C:ssä keskipaikkaan, jonka työn painikkeet jo käyttävät. Kierros vie
painikkeen portaalilla tuotannon riville ja järjestää sen CSS:n `order`illa.
