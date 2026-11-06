# Nykyinen sääntö (6.11.2026)

Selain päättää siirtymät; host ei pidä lukutilaa.

- **Sinun vuoroosi** keskustelu tulee, kun agentin vuoro päättyy uudella
  vastauksella (`turn.settled`-tapahtuma tai snapshotin `last_reply`, jota
  tämä selain ei ole vielä nähnyt), kun agentti kysyy (`pending_question`
  käynnissä olevalta Pi:ltä) tai kun historia katoaa tai rikkoutuu.
  `web/src/app/railNow.ts`: `turn = attention === "new" || (pendingQuestion && running)`.
- **Hiljaisiin** se siirtyy heti, kun keskustelu on auki näkyvässä
  välilehdessä: `App.tsx` kutsuu reitin vaihtuessa ja `visibilitychange`-
  tapahtumassa `conversationStore.setVisible`, joka merkitsee vastauksen
  nähdyksi (`markSeen`). Merkki tallentuu `localStorage`en
  (`oh.replies.seen.<identity>`, `replySeen.ts`), joten se koskee vain tätä
  selainta: toisella laitteella sama vastaus on yhä uusi. Myös viestin
  lähettäminen (`command.changed` pending) ja kysymyksen ratkeaminen
  poistavat huomion; lähetetty keskustelu menee Käynnissä-osioon.
- **Kesto ja vastaaminen eivät vaikuta.** Sekunnin vilkaisu kuittaa saman
  kuin vastaus. Rivi siirtyy Hiljaisiin jo silloin, kun keskustelu on vielä
  auki.
- **Hiljaisista takaisin** pääsee vain agentin uudesta vastauksesta tai
  kysymyksestä. Aikaa, käsin nostoa tai muistutusta ei ole (nosto on
  kierroksessa `proto-raise-quiet-to-your-turn`).

Tämän vuoksi Jarin kuvaama tilanne toistuu: avaa, puhelin soi, poistuu, ja
keskustelu on Hiljaisissa muiden vanhojen joukossa.

# Kierros 1: laukaisijat

Kierros: `design-system/prototypes/rounds/2026-11-06-hiljaisiin-siirtyminen/`
(NOTES.md kertoo päivän käsikirjoituksen ja vuorovaikutukset). Akseli: mikä
siirtää keskustelun Sinun vuorosi → Hiljaiset ja takaisin. Sama päivä
(avaat NDA:n, lähdet kiireesti 12 sekunnin päästä, luet Laskun luonnoksen
vastaamatta, kokous, paluu 12.40) toistetaan jokaisen säännön alla, ja
yläreunan nauha näyttää kolmen keskustelun paikan joka hetkellä.

- **Nyt**: avaaminen kuittaa heti, kun keskustelu näkyy, vaikka vilkaisisit vain sekunnin. Takaisin Sinun vuoroosi vain agentin uudesta vastauksesta tai kysymyksestä.
- **A Vastaus**: Sinun vuorosi pysyy, kunnes vastaat agentille tai valitset Ei nyt. Avaaminen vain sammuttaa pallon renkaaksi (Luettu). Takaisin agentin uudesta vastauksesta.
- **B Luku**: kuittaa vasta luettu: auki 20 s ja vastauksen loppu näkyi. Vilkaisu jää Sinun vuoroosi, ja luettu siirtyy Hiljaisiin vasta kun poistut. Takaisin agentin uudesta vastauksesta.
- **C Paluu**: avaaminen kuittaa kuten nyt, mutta vastaamatta jätetty palaa Sinun vuoroosi 2 tunnin päästä (Palasi). Avoin keskustelu kertoo milloin, ja ajan voi vaihtaa.

## Mitä kukin päättää

| | → Hiljaiset | → Sinun vuorosi | 12.40: NDA (kesken) | 12.40: Lasku (hoidettu, ei vastausta) |
|---|---|---|---|---|
| Nyt | näkyminen | agentin vastaus tai kysymys | Hiljaiset | Hiljaiset |
| A | vastaus tai *Ei nyt* | agentin vastaus | Sinun vuorosi, rengas | Sinun vuorosi, rengas (vaatii *Ei nyt*) |
| B | 20 s + loppu näkyi, poistuessa | agentin vastaus | Sinun vuorosi, *Vilkaisit 12 s* | Hiljaiset |
| C | näkyminen, mutta ajastin | agentin vastaus tai aika (2 h, muutettavissa) | Sinun vuorosi, *Palasi* (vasta 11.20 jälkeen) | Sinun vuorosi, *Palasi* (turha) |

## Suositus

**A, Ei nyt -toiminnolla.** Jarin ongelma on, että käynti kuittaa. A:ssa
kuittaa vain teko, jonka hän itse tekee: vastaus tai *Ei nyt*. Kiire ei
siis koskaan hukkaa keskustelua, eikä sääntö arvaa mitään. Se on sama
periaate kuin edellisen kierroksen nostossa, jota suosittelin: nostettu
pysyy, kunnes vastaat tai sanot *Ei nyt*. Kaksi mekanismia voisi olla yksi.
Rengas kertoo, että olet jo käynyt siellä, joten uusi vastaus ja vanha
kesken jäänyt erottuvat.

A:n hinta näkyy Laskussa: luettu ja hoidettu keskustelu, johon ei tarvitse
vastata, jää Sinun vuoroosi, kunnes painat *Ei nyt*. Yksi painallus on
kuitenkin pienempi vaiva kuin unohtunut NDA. Jos se alkaa kertyä, B:n
lukusääntö voisi myöhemmin kuitata renkaan, mutta B yksin perustuu
arvaukseen: 20 sekuntia ja vieritys eivät tiedä, luitko vai jäitkö
miettimään. Lisäksi se mittaa vain tätä selainta. C korjaa kiireen
vasta viiveellä (NDA puuttuu Sinun vuorosista 9.20–11.20) ja tuo takaisin
myös hoidetun Laskun. Ajastin sopii paremmin *Ei nyt* -toiminnon
lisävalinnaksi ("muistuta huomenna") kuin oletussäännöksi (kysymys 3).

## Mitä toteutus tarvitsee hostilta

- **A:n "vastasit" on hostin tiedossa jo nyt.** Daemon hyväksyy henkilön
  viestin, ja natiivihistoriasta näkyy, onko henkilön viesti agentin
  viimeisen vastauksen jälkeen. Siksi A toimii samoin joka laitteella
  ilman lukutilaa. Sinun vuorosi voidaan laskea: viimeinen sana on
  agentin (`last_reply`), eikä *Ei nyt* -merkkiä ole saman vastauksen
  kohdalla.
- **Rajaus vanhoihin.** Pelkkä "agentti puhui viimeksi" nostaisi kaikki
  vanhat keskustelut. Raja tarvitaan: selaimen nykyinen `horizon`
  (`replySeen.ts`) tai hostin aika, jolloin henkilö otti uuden säännön
  käyttöön. Ensimmäisellä kerralla vanhat jäävät Hiljaisiin.
- **Ei nyt on hostin merkki.** Sama tiedosto kuin edellisen kierroksen
  nostossa: daemon pitää henkilön kotihakemistossa `agent_id` → kuitatun
  vastauksen `last_reply.id`. Merkki raukeaa itsestään, kun agentti vastaa
  uudelleen (id vaihtuu). Snapshotiin tulee kenttä, muutos lähtee
  tapahtumana, ja kirjoituspolku on daemonilla. Gateway ei saa uutta
  auktoriteettia.
- **Rengas (luettu) voi jäädä selaimen tilaksi.** Nykyinen
  `oh.replies.seen` riittää: se muuttaa vain pallon, ei osiota. Toisella
  laitteella pallo on täysi, mutta rivi on samassa osiossa.
- **B** tarvitsisi lukuajan ja vierityksen mittauksen selaimessa
  (`ConversationTimeline`in loppu näkyvissä). Jotta se näkyisi muilla
  laitteilla, hostin pitäisi tallentaa luettu-merkki, eli uusi hostin
  lukutila. Sitä tuote on tähän asti välttänyt.
- **C**:n ajastimen on oltava hostilla. Selaimen ajastin laukeaa vain, kun
  välilehti on auki, ja toinen laite ei näkisi sitä. Paluuaika olisi sama
  daemonin merkki aikaleimalla.
- Pi:n istuntotiedostoon ei kirjoiteta mitään: se muuttaisi `changed_at`ia
  ja Hiljaisten järjestystä (sama syy kuin nostossa).

## Kysymykset Jarille

1. **Pysyykö avattu Sinun vuorosissa renkaana, kunnes vastaat**
   (`k1-a-vastaus-0-oletus`), **vai riittääkö, että vilkaisu ei kuittaa,
   mutta kunnolla luettu kuittaa** (`k1-b-luku-0-oletus`)?
2. **Hoidettu keskustelu, johon ei tarvitse vastata** (Lasku): onko *Ei nyt*
   -painallus sopiva hinta (`k1-a-vastaus-2-avattu-pysyy`), vai pitääkö se
   kuitata itsestään?
3. **Paluu ajan perusteella** (`k1-c-paluu-3-muuta`): tarvitaanko sitä
   lainkaan, ja jos, oletuksena vai vain *Ei nyt* -valikon "muistuta
   myöhemmin" -valintana?

## Todisteet

`evidence/k1-*`: jokaisesta suunnasta oletushetki 12.40 (0, puhelimessa
myös `0-sivupalkki`), kiireinen poistuminen 9.20 (1), NDA:n avaaminen
suunnan tavalla (2–3: A pysyy ja *Ei nyt*, B luet ja luettu, C paluuaika ja
sen muutos, Nyt avattu) ja 12.42 vastattu (4). Kuvat ovat 1440 vaalea ja
tumma sekä 390 vaalea, kertoimella 2. `check.mjs`: 252 tarkistuspistettä,
konsoli puhdas. Kyse on synteettisestä komponenttilabrasta; sitä ei ole
ajettu hostia vasten.

## Näyttäminen

```
node design-system/prototypes/rounds/2026-11-06-hiljaisiin-siirtyminen/build.mjs
open-habitat agent view offer --current \
  --source design-system/prototypes/dist/hiljaisiin-siirtyminen/offline.html \
  --title "Sinun vuorosi ↔ Hiljaiset – kierros 1" \
  --idempotency-key "$(uuidgen)" --json
```

# Kierros 2: Ei nyt -painikkeen paikka

Kierros: `design-system/prototypes/rounds/2026-11-06-ei-nyt-paikka/`
(NOTES.md kertoo suunnat ja vuorovaikutukset). Jarin päätös 6.11.:
lähtökohta A Vastaus, ja riffataan, missä on painike, joka pudottaa
keskustelun Hiljaisiin. Akseli: Ei nyt -painikkeen paikka. Nosto on
kaikissa suunnissa päätetyn mukainen (kentän rivin keskipaikalla *Nosta* ja
sivupalkin rivillä ⤒). Ei nyt on yksi toiminto sekä luetulle vastaukselle
(rengas) että nostetulle (nuoli). Oletusnäkymä on juuri avattu
*NDA-viestin tarkistus*, joka on Sinun vuorosissa renkaana.

- **Nyt**: avaaminen siirtää keskustelun heti Hiljaisiin. Ei nyt -painiketta ei tarvita, eikä Hiljaisista voi nostaa.
- **A Kenttä**: Ei nyt on kentän rivin keskipaikalla, samassa kohdassa kuin Hiljaisten keskustelun Nosta: yksi painike, kaksi tilaa.
- **B Sivupalkki**: Ei nyt on Sinun vuorosi -rivillä ⤓-painikkeena kynän ja arkiston vieressä, kuten ⤒ Hiljaisten rivillä; avaamatta.
- **C Vastaus**: Ei nyt on agentin viimeisen vastauksen alla rivillä Odottaa vastaustasi; se katoaa, kun vastaat.

## Mitä kukin päättää

| | Paikka | Pudottaa avaamatta | Noston jälkeen | Puhelin |
|---|---|---|---|---|
| A | Kentän keskipaikka, Noston toinen tila | Ei | Sama pilleri vaihtuu *Nosta* → *Ei nyt* | Pilleri nimen kanssa kentän rivillä |
| B | Sivupalkin rivin ⤓ kynän vieressä | Kyllä, useita peräkkäin | Nosta katoaa kentästä, ⤓ ilmestyy riville | Vaatii sivupalkin avaamisen |
| C | Viimeisen vastauksen alla, sanoin | Ei | Nosta katoaa kentästä, rivi ilmestyy vastauksen alle | Rivi luettavan alla |

## Suositus

**A.** Nosto ja Ei nyt ovat saman asian kaksi suuntaa, ja A antaa niille
yhden painikkeen yhdessä paikassa: kentän keskipaikalla lukee aina, mitä
keskustelulle voi tehdä (*Nosta* tai *Ei nyt*), ja painallus vaihtaa sen.
Paikka on vapaa juuri silloin, kun painike on käytettävissä (agentti ei
työskentele), ja se on siinä, missä päätät, vastaatko nyt. Kiireessä
lähtevälle tämä on luonteva hetki sanoa Ei nyt. Puhelimessa se toimii
avaamatta sivupalkkia. B:n vahvuus on pudottaminen avaamatta ja useiden
siivoaminen kerralla. Koska nostossakin on sivupalkin ⤒, ⤓ samalla
rivillä olisi A:n luonteva pari (kysymys 2). Yksinään B jättää avoimen
keskustelun ilman painiketta, ja puhelimessa pudottaminen vaatii laatikon.
C sanoo tilan selvimmin siinä, mitä luet, mutta painike vaihtaa paikkaa
noston jälkeen (kentästä vastauksen alle), ja pitkässä vastauksessa rivi
vierii näkyviin vasta lopussa.

A:ssa nostetun keskustelun pilleri on *Ei nyt*, ei kierroksen 3 *Sinun
vuorossasi ✕*. Silloin nimi ei riipu siitä, miksi keskustelu on Sinun
vuorosissa. Tämä muuttaa `raise-to-your-turn-button`-toteutuksen
nostettua tilaa (kysymys 3).

## Mitä toteutus tarvitsee hostilta

Kierroksen 1 hostiosuus pätee sellaisenaan, eikä painikkeen paikka muuta sitä:

- Sinun vuorosi lasketaan: viimeinen sana on agentin (`last_reply`), eikä
  sen kohdalla ole Ei nyt -merkkiä. Lisäksi tarvitaan raja vanhoihin
  keskusteluihin (käyttöönoton aika tai nykyinen `horizon`).
- **Ei nyt ja nosto ovat yksi daemonin merkki** henkilön kotihakemistossa:
  `agent_id` → joko *nostettu (aika)* tai *ei nyt (kuitatun vastauksen
  `last_reply.id`)*. Ei nyt raukeaa itsestään, kun agentti vastaa uudelleen
  (id vaihtuu); nosto raukeaa, kun daemon hyväksyy henkilön viestin.
  Snapshotin agentti saa kentän, ja muutos lähtee tapahtumana, joten
  kaikki laitteet näkevät saman. Gateway ei saa uutta auktoriteettia, eikä
  Pi:n istuntotiedostoon kirjoiteta mitään.
- Rengas (luettu) voi jäädä selaimen tilaksi (`oh.replies.seen`); se muuttaa
  vain pallon, ei osiota.
- Komponenttipaikat: A `Composer`in keskipaikka (sama kuin noston),
  B `AgentNavItem`in painikeryhmä (sama kuin noston ⤒), C
  `ConversationTimeline`in viimeisen vastauksen alle paikka.

## Kysymykset Jarille

1. **Missä Ei nyt on**: kentän rivin keskipaikalla
   (`k2-a-kentta-0-oletus-1440-light`), sivupalkin rivillä
   (`k2-b-sivupalkki-0-oletus-1440-light`) vai vastauksen alla
   (`k2-c-vastaus-0-oletus-1440-light`)?
2. **Lisäksi sivupalkin rivillä ⤓**, kuten nostossa ⤒
   (`k2-b-sivupalkki-0-sivupalkki-390-light`), jotta useita voi pudottaa
   avaamatta, vai riittääkö yksi paikka?
3. **Nostetun nimi**: kelpaako *Ei nyt* myös nostetulle keskustelulle
   (`k2-a-kentta-2-nostettu-1440-light`) kierroksen 3 *Sinun vuorossasi ✕*
   -nimen sijaan?

## Todisteet

`evidence/k2-*`: jokaisesta suunnasta oletusnäkymä (0, puhelimessa myös
`0-sivupalkki`), Ei nyt painettu (1), uudelleen nostettu (2, puhelimessa
myös `2-sivupalkki`), toinen uusi vastaus avattu ja pysyy (3), vastattu ja
agentin vastaus tuonut takaisin (4) sekä sivupalkin ⤒ avaamatta (5, B:ssä
myös ⤓ avaamatta). Nyt-tilasta oletusnäkymä. Kuvat ovat 1440 ja 390,
vaalea ja tumma, kertoimella 2. `check.mjs`: 382 tarkistuspistettä,
konsoli puhdas. Kyse on synteettisestä komponenttilabrasta; sitä ei ole
ajettu hostia vasten.

## Näyttäminen

```
node design-system/prototypes/rounds/2026-11-06-ei-nyt-paikka/build.mjs
open-habitat agent view offer --current \
  --source design-system/prototypes/dist/ei-nyt-paikka/offline.html \
  --title "Sinun vuorosi ↔ Hiljaiset – kierros 2: Ei nyt -painikkeen paikka" \
  --idempotency-key "$(uuidgen)" --json
```
