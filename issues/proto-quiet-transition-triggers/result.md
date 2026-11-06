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
