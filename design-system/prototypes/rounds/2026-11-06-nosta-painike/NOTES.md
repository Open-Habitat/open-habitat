# Nosta Hiljaisista – kierros 2: painike

Issue `proto-raise-quiet-to-your-turn`. Jari 6.11.: nostolle painike muiden
painikkeiden joukkoon, ei valikkoa. Tämä kierros riffaa, minkä painikkeiden
joukossa nosto on ja miltä se siellä näyttää. Edellinen kierros on
`../2026-11-03-nosta-hiljainen/`. Rakennettu tuotannon komponenteista
(`AppShell`, `WorkspaceRail`, `AgentNavItem`, `WorkspaceNavRow`,
`AgentHeader` Kooste-, Arkistoi- ja Tiedot-painikkeineen, `NextWaitingRow`,
`ConversationTimeline`, `UserMessage`, `AssistantMessage`, `ControlButton`,
`Composer`). Kierroksen omia ovat nostopainikkeet, nostetun rivin nuoli ja
oletusnäkymän näytetty vihje. Kaikki on synteettistä.

Erillinen kysymys siitä, milloin keskustelu putoaa Hiljaisiin, on issuessa
`proto-quiet-transition-triggers`, eikä sitä ratkaista tässä.

## Ero edelliseen oletusnäkymässä

Kierros 1 avautui *Kesäajan virheeseen* ja *Sillä aikaa* -riviin. Tämä avautuu
Hiljaisten keskusteluun *Contosoin tapaaminen*, joten nostopainike näkyy heti:

- **Nyt**: Hiljaisista ei voi nostaa. Sinun vuoroosi tulee vain agentin valmis vuoro, ja avaaminen kuittaa sen.
- **A Yläpalkissa**: ↑-kuvake yläpalkin painikkeiden joukossa Koosteen ja Arkistoi-painikkeen vieressä. Nostettuna se on oranssi ja laskee painettaessa.
- **B Kentän luona**: tekstipainike *Palaan tähän* kentän alarivillä mallin vieressä. Nostettuna siinä lukee *Sinun vuorossasi* ja ✕ laskee.
- **C Rivillä**: ↑ sivupalkin rivillä kynän ja arkiston rinnalla, joten nostaa voi avaamatta. Nostetulla rivillä samassa kohdassa on ↓.

A:ssa ja C:ssä oletusnäkymä näyttää painikkeen vihjeen (C:ssä myös rivin
painikkeet kuin osoitin olisi rivillä); vihje katoaa ensimmäisestä
painalluksesta.

## Yhteistä kaikille suunnille

Nosto itse on kierroksen 1 suosituksen mukainen, jotta vertailtavana on vain
painike: nostetun pallon paikalla on oranssi nuoli, viimeksi nostettu on
Sinun vuorosin ja *Sillä aikaa* -rivin kärjessä, avaaminen ei kuittaa nostoa,
ja nosto päättyy, kun vastaat tai painat samaa painiketta uudelleen.
Keskustelua, jonka agentti on työssä tai joka jo odottaa vastauksena, ei
voi nostaa: A:ssa painike on silloin pois käytöstä syyn kanssa, B:ssä
painiketta ei ole, C:ssä rivillä ei ole nostopainiketta.

## Mitä kussakin tapahtuu

- **A.** ↑ on yläpalkissa ennen Koostetta, joten se on joka keskustelussa
  samassa paikassa kuin muut keskustelun toiminnot. Puhelimessa yläpalkin
  harvinaiset toiminnot siirtyvät ⋯-valikkoon, mutta nosto jää ensimmäiselle
  riville ⋯:n viereen. Nostettuna kuvake on oranssi ja painettuna (*Laske
  Hiljaisiin*). Nostaminen vaatii, että keskustelu on auki.
- **B.** *Palaan tähän* on kentän alarivillä, siis siinä, missä päätät
  vastaatko nyt. Nostettuna painike sanoo *Sinun vuorossasi ✕*, joten nosto
  näkyy avoimessa keskustelussa sanoin. Kun agentti työskentelee, painiketta
  ei ole. Puhelimessa painike vie tilaa: mallin nimi lyhenee (*A…*).
- **C.** ↑ on sivupalkin rivin painikkeissa kynän ja arkiston rinnalla:
  työpöydällä osoittimen alla, puhelimessa aina näkyvissä kuten kynä ja
  arkisto nyt. Mitä tahansa Hiljaisten keskustelua voi nostaa avaamatta sitä.
  Nostetun rivin ↓ laskee. Avoimessa keskustelussa itsessään nostosta ei ole
  merkkiä; se näkyy vain sivupalkissa.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-06-nosta-painike/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-nosta-painike/check.mjs \
  design-system/prototypes/dist/nosta-painike/offline.html <kuvahakemisto>
```

`check.mjs` käy Nyt-tilan ja jokaisen suunnan läpi vaaleana ja tummana,
1440 px osoittimella ja 390 px kosketuksella: oletusnäkymä, nosto suunnan
painikkeella, nostettu Sinun vuorosissa, työssä olevan keskustelun estetty
nosto, viesti *Kesäajan virheeseen* ja *Sillä aikaa* -rivi nostettu
kärjessä, *Avaa seuraava* (nosto pysyy), lasku samalla painikkeella ja
lopuksi C:ssä nosto avaamatta tai A:ssa ja B:ssä vastaaminen (268
tarkistuspistettä, konsoli puhdas, kuvat kertoimella 2, etuliite `r2-`).
`index.html` on sama ilman upotettuja fontteja glasspadia varten.

C:n painike viedään portaalilla tuotannon rivin omaan painikeryhmään
(`.ah-nav-archive`), jotta se näkyy ja piiloutuu täsmälleen kuten kynä ja
arkisto. Rivi luo ryhmän uudelleen siirtyessään osiosta toiseen, joten
portaali etsii sen myös seuraavassa ruudussa. Toteutus tarvitsee
`AgentNavItem`iin oman paikan kolmannelle painikkeelle; A tarvitsee
`AgentHeader`iin paikan, joka jää puhelimessa ensimmäiselle riville (nyt
kierros käyttää `terminal`-paikkaa), ja B `Composer`in alariville paikan
mallin viereen.
