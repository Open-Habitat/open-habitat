# Nosta Hiljaisista – kierros 1

Issue `proto-raise-quiet-to-your-turn`. Hiljaisten keskustelun nostaminen
käsin Sinun vuoroosi, jolloin se tulee mukaan *Sillä aikaa* -riville kuin
keskustelu, jonka agentti juuri valmistui. Rakennettu tuotannon
komponenteista (`AppShell`, `WorkspaceRail`, `AgentNavItem`,
`WorkspaceNavRow`, `NextWaitingRow`, `AgentHeader`, `ConversationTimeline`,
`UserMessage`, `AssistantMessage`, `Menu`, `Checkbox`, `TextField`,
`ControlButton`, `Composer`; osioiden ja Hiljaisten otsakkeen luokat
tuotannon CSS:stä). Kierroksen omia ovat nostopainikkeet, pyyhkäisy,
nostetun nuolimerkki, C:n Nostamasi-ryhmä ja sen *Sillä aikaa* -teksti sekä
avoimen nostetun keskustelun ilmoitusrivi. Hiljaisten järjestys- ja
työtilavalikko on jätetty pois, koska se ei kuulu kierrokseen. Kaikki on
synteettistä.

Hostin faktat ja tarpeet ovat issuen `result.md`:ssä.

## Suunnat

Akseli: miten Hiljaisten keskustelu nostetaan Sinun vuoroosi ja mitä
nostettu rivi sen jälkeen on.

- **Nyt**: Hiljaisista ei voi nostaa. Sinun vuoroosi ja Sillä aikaa -riville tulee vain agentin valmis vuoro, ja avaaminen kuittaa sen.
- **A Pallosta**: Hiljaisen rivin pallo muuttuu osoittimen alla nostonapiksi (puhelimessa pyyhkäisy oikealle). Nostettu näyttää valmiilta vuorolta ja poistuu, kun avaat sen.
- **B Valikosta**: rivin ja keskustelun ⋯-valikossa Nosta Sinun vuoroosi. Nostettu on merkitty nuolella, menee jonon kärkeen ja pysyy, kunnes vastaat tai valitset Ei nyt.
- **C Nostamasi**: Sinun vuorosi -otsikon + valitsee Hiljaisista. Nostetut ovat omana ryhmänään vastausten jälkeen, Sillä aikaa laskee ne erikseen, ja ✕ laskee takaisin.

Oletusnäkymä on sama tilanne kaikissa: olet juuri lähettänyt viestin
*Kesäajan virheeseen*, agentti on työssä, ja *Sillä aikaa* -rivi on auki.
*NDA-viestin tarkistus* odottaa valmiina vastauksena. A:ssa, B:ssä ja C:ssä
*Contosoin tapaaminen* on jo nostettu, jotta nostetun ulkoasu näkyy heti, ja
A näyttää *Etusivun kuvat* -rivin osoittimen alla nostonappeineen.

## Mitä kussakin tapahtuu

- **Nyt.** Avaat *NDA-viestin tarkistuksen*, ja se siirtyy Hiljaisiin.
  Muuta tietä Sinun vuoroosi ei ole.
- **A.** Työpöydällä pallo vaihtuu osoittimen alla ↑-napiksi; puhelimessa
  rivi pyyhkäistään oikealle (*Nosta*). Nostettu rivi on Sinun vuorosissa
  tavallisen oranssin pallon kanssa luettelon järjestyksessä, ja vain sen
  kuvaus sanoo *Nostit Sinun vuoroosi*. *Sillä aikaa* -rivin luku kasvaa
  heti. Kun avaat sen, se palaa Hiljaisiin kuin luettu vastaus. Sinun
  vuorosin rivin pallo on osoittimen alla ↓ (*Ei nyt*), puhelimessa
  pyyhkäisy vasemmalle; se laskee myös luetuksi merkitsemättömän
  vastauksen.
- **B.** Jokaisella rivillä on ⋯ (puhelimessa aina näkyvissä, kynän ja
  arkiston sijasta): *Nosta Sinun vuoroosi*, *Nimeä uudelleen*, *Arkistoi*.
  Sama on keskustelun otsakkeen ⋯:ssä. Nostetun pallon paikalla on
  oranssi nuoli, ja viimeksi nostettu on Sinun vuorosin ja *Sillä aikaa*
  -rivin kärjessä, joten *Avaa seuraava* vie siihen. Avattuna se pysyy
  Sinun vuorosissa, ja kentän yllä lukee *Nostit tämän Sinun vuoroosi. Se
  odottaa siellä, kunnes vastaat.* sekä *Ei nyt*. Viestin lähettäminen vie
  sen Käynnissä-osioon, ja nosto päättyy.
- **C.** Sinun vuorosi -otsikon + avaa listan Hiljaisista valintaruutuineen
  (haku yllä). Valitut tulevat Sinun vuorosin alle omaksi *Nostamasi*
  -ryhmäkseen nostojärjestyksessä. *Sillä aikaa* sanoo *1 odottaa sinua · 2
  nostamaasi*, ja *Avaa seuraava* vie ensin vastauksiin. Avattuna nostettu
  pysyy kuten B:ssä; rivin ✕ tai ilmoitusrivin *Ei nyt* laskee sen.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-03-nosta-hiljainen/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-03-nosta-hiljainen/check.mjs \
  design-system/prototypes/dist/nosta-hiljainen/offline.html <kuvahakemisto>
```

`check.mjs` käy Nyt-tilan ja jokaisen suunnan läpi vaaleana ja tummana,
1440 px osoittimella ja 390 px kosketuksella (pyyhkäisy oikeina
kosketustapahtumina): oletusnäkymä, nosto suunnan omalla tavalla, nostettu
Sinun vuorosissa ja *Sillä aikaa* -rivillä, *Avaa seuraava*, poistuminen
suunnan tavalla ja B:ssä vastaaminen (208 tarkistuspistettä, konsoli puhdas,
kuvat kertoimella 2). `index.html` on sama ilman upotettuja fontteja
glasspadia varten.

Rivin omat painikkeet ovat kierroksessa tuotannon rivin vieressä, koska
`AgentNavItem` ei ota vasempaan reunaan omaa toimintoa eikä ⋯-valikkoa.
Toteutus tarvitsee valitulle suunnalle rivin paikan (A: pallo painikkeeksi,
B: `trailing`-valikko kynän ja arkiston tilalle, C: ✕).
Pyyhkäisy kuuntelee kaappausvaiheessa, koska rivin painalluskäsittely
pysäyttää osoitintapahtumat.
