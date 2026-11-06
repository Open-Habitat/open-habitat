# Kierros 1: samanaikaisten keskustelujen raja asetuksena

Kierros: `design-system/prototypes/rounds/2026-11-05-samanaikaiset-keskustelut/`
(NOTES.md kertoo suunnat ja vuorovaikutukset). Akseli: kuka rajan asettaa
ja missä ihminen näkee, mikä pitää paikkaa. Kaikissa on sama hetki: uusi
keskustelu *kotisivu*-työtilassa ei käynnistynyt, koska raja on täynnä.

- **Nyt**: vakio neljä. Uusi keskustelu kieltäytyy, Yritä uudelleen yrittää samaa, eikä mikään kerro, mitkä neljä pitävät paikkaa.
- **A Oma**: raja on henkilön oma asetus Asetukset › Tekoäly -sivulla. Kieltäytyminen vie sinne; asetuksen alla näkyy, mikä työskentelee nyt, ja sen voi pysäyttää.
- **B Ylläpitäjä**: ylläpitäjä asettaa oletuksen koko asennukselle ja tarvittaessa henkilöittäin (Ylläpito › Palvelin). Kieltäytyminen avaa ikkunan, jossa paikkaa pitävät voi pysäyttää.
- **C Ei lukua**: ei asetusta. Palvelin kieltäytyy vain, kun muisti loppuu, ja kieltäytyminen näyttää itse listan siitä, mikä työskentelee nyt.

## Mitä kukin päättää

| | Kuka asettaa | Missä luku näkyy | Missä paikkaa pitävät näkyvät | Kieltäytymisen tie |
|---|---|---|---|---|
| A | Henkilö itse (enintään palvelimen katto 30) | Asetukset › Tekoäly ja sivupalkin mittari *6/6 paikkaa* | Asetussivulla rajan alla | Kortti → asetukset → nosta tai pysäytä → takaisin, *Aloita keskustelu* |
| B | Ylläpitäjä: oletus kaikille ja oma luku henkilölle | Kortissa ja ylläpidon taulukossa (nyt / raja) | Ikkunassa kortin päällä; kortissa lajit merkkeinä | Kortti → ikkuna → pysäytä → *Aloita keskustelu*; ylläpitäjälle myös *Muuta rajaa* |
| C | Ei kukaan; palvelin päättää muistista | Ei missään | Suoraan kortissa | Pysäytä kortista → *Tilaa on nyt* → *Aloita keskustelu* |

Kaikissa suunnissa lista kertoo jokaisesta keskustelusta työtilan, mitä
se tekee (*Työskentelee*, *Kysyy sinulta*, *Odottaa taustatyötä* ja
prosessin komento) ja kauanko, ja pysäytyspainike on lajin mukainen
(*Pysäytä vuoro*, *Pysäytä prosessi*). Rivin otsikko avaa keskustelun.

## Suositus

**B:n ylläpitäjän asetus ja C:n kortti.** Raja suojaa palvelinta ja
jakaa sen ihmisten kesken, joten sen asettaa se, joka vastaa palvelimesta:
oletus koko asennukselle ja tarvittaessa oma luku henkilölle, samassa
muodossa kuin levytilan rajat jo ovat (*Ylläpito › Palvelin* tai oma
ylläpidon osio). Henkilön oma raja (A) ei suojaa mitään, mitä hän
tarvitsisi: kukaan ei halua estää itseään aloittamasta keskustelua, ja
tilauksen käyttörajat ovat palveluntarjoajan, eivät tämän luvun. A:n
mittari sivupalkissa näyttää luvun aina, vaikka se merkitsee jotain vain
rajan kohdalla.

Rajaan törmäävälle näkyy C:n kortti: lista paikkaa pitävistä ja
pysäytys suoraan kieltäytymisen kohdalla, ilman ikkunaa tai
asetuskierrosta. Juuri siinä hetkessä ihminen päättää, mikä saa väistyä,
ja näkee, että kaksi paikkaa on taustaprosessilla eikä vuorolla. Kortti
kertoo luvun ("rajasi on 6") vain, kun ylläpitäjä on sen asettanut;
ylläpitäjälle siinä on lisäksi *Muuta rajaa*. Jos ylläpitäjä ei aseta
lukua, käytetään `live-conversation-limit-relax`-korjauksen korkeaa
isäntärajaa, ja kortti sanoo C:n tavoin, että palvelimella ei ole tilaa.

## Mitä host-tietoja näkymä olettaa

- **Paikkaa pitävien lista.** Daemon tietää jo täsmälleen tämän:
  `classify` (`internal/daemon/pi_activity_linux.go`) palauttaa kiireiset
  keskustelut lajeineen (`turn`, `question`, `processes`, `unknown`), ja
  työtilan poiston esteet välittävät saman `activity`-kentän selaimelle
  (`workspace-deletion.schema.json`). Kieltäytyminen `429
  capacity_exceeded` tarvitsee saman listan (agent_id, activity) mukaansa
  tai erillisen lukureitin; uutta tilaa ei tarvita. Prosessin komento ja
  kesto tulevat Pi:n prosessisillasta (`backgroundActivity` lukee jo
  `records`).
- **Pysäytys vapauttaa paikan vasta, kun lapsi on joutilas.** Vuoron tai
  kysymyksen pysäytys on nykyinen abort, prosessin pysäytys nykyinen
  prosessisillan stop. Paikka vapautuu, kun `makeRoom` seuraavalla
  luonnilla pysäyttää nyt joutilaan lapsen, joten *Aloita keskustelu*
  toimii heti pysäytyksen jälkeen. `unknown`-tila (luku epävarma) tarvitsee
  oman sanansa listaan; kierros ei näytä sitä.
- **Ylläpitäjän luku daemonille.** Daemon valvoo rajaa henkilön omana
  käyttäjänä eikä luota gatewayn väitteisiin. Ylläpitäjän luku pitää siis
  viedä daemonille rootin kirjoittamana tietona, kuten sivuston
  `site_origin_file` jo viedään, eikä selaimen pyynnössä. Tämä on
  valtuuden sijoitus, joka päätetään ennen toteutusta.
- **Raja ei ole turvaraja.** Henkilö voi käynnistää Pi:n päätteessä
  daemonin ohi, joten daemonin luku jakaa palvelinta kohteliaasti mutta ei
  suojaa sitä. Todellinen suoja muistin loppumista vastaan olisi henkilön
  `user-<uid>.slice`n muistiraja; nykyiset `systemd/`-pohjat eivät aseta
  sellaista. C:n "muisti ei riitä" olettaa joko tällaisen rajan tai
  daemonin oman muistiarvion; `live-conversation-limit-relax` valitsee.
- **Muistiarvio ylläpitäjälle.** B:n ohjeteksti (noin 200 Mt
  keskustelua kohden, palvelimella 30 Gt) on Northwindin havainto
  (`live-conversation-limit-relax`). Oikea luku tulisi
  `/proc/meminfo`sta ja mitatusta Pi-lapsen koosta.
- **Sama raja koskee jatkamista.** Lähetys joutilaaseen, jo pysäytettyyn
  keskusteluun käynnistää lapsen ja voi saada saman kieltäytymisen
  (`held_linux.go`). Kierros näyttää vain uuden keskustelun; sama kortti
  sopii odottavan viestin alle.

## Kysymykset Jarille

1. Kuka asettaa rajan: henkilö itse
   (`evidence/a-oma-1-asetukset-1440-light.avif`), ylläpitäjä
   (`evidence/b-yllapitaja-4-yllapito-1440-light.avif`) vai ei kukaan,
   palvelin päättää muistista
   (`evidence/c-ei-lukua-0-oletus-1440-light.avif`)?
2. Missä paikkaa pitävät näkyvät rajaan törmätessä: suoraan kortissa
   (`evidence/c-ei-lukua-0-oletus-1440-light.avif`) vai ikkunassa
   (`evidence/b-yllapitaja-1-ikkuna-1440-light.avif`)?
3. Näkyykö täyttöaste sivupalkissa aina
   (`evidence/a-oma-0-oletus-1440-light.avif`, *6/6 paikkaa*) vai vain
   rajaan törmätessä?

## Tarkistus

`check.mjs`: 184 tarkistuspistettä, konsoli puhdas. Nyt ja kaikki kolme
suuntaa läpi 1440 px ja 390 px (kosketus), vaaleana ja tummana,
kieltäytymisestä uuteen käynnissä olevaan keskusteluun; B:ssä lisäksi
ylläpitäjän henkilökohtainen raja. Kuvat kertoimella 2 hakemistossa
`evidence/` (AVIF). Kaikki on synteettistä; host on `fetch`-sijainen.

# Kierros 2: B:n riffit – Muuta rajaa ja Mitkä pitävät paikkaa

Kierros: `design-system/prototypes/rounds/2026-11-06-samanaikaiset-keskustelut-2/`
(NOTES.md kertoo riffit ja vuorovaikutukset). Jarin 6.11. päätöksen mukaan
B Ylläpitäjä jatkaa: *Muokkaa* on poistettu, *Yritä uudelleen* jää, *Muuta
rajaa (ylläpitäjä)* toimii vain ylläpitäjälle, ja akselina on *Mitkä
pitävät paikkaa* -lista. Yläpalkin **Katsoja** näyttää kortin ylläpitäjälle
sekä muulle kahdella tavalla (nappi piilossa / näkyy pois käytöstä syineen).
Daemonin raja on nyt 32; kierroksessa ylläpitäjä on asettanut asennukselle
12, ja kaikki 12 työskentelevät (6 vuoroa, 2 kysymystä, 4 taustaprosessia),
jotta listan pituus näkyy.

- **1 Lajeittain**: kortissa lajit painikkeina (taustaprosessit, odottaa vastaustasi, vuoro käynnissä); painike avaa ikkunan sen lajin kohdalta, taustaprosessit ensin.
- **2 Kortissa**: lista on kortissa itsessään, unohdetuin ensin (milloin kirjoitit viimeksi); kolme näkyy, loput Näytä kaikki -painikkeen takana. Ei ikkunaa.
- **3 Työtiloittain**: kortissa työtilat painikkeina, tämä työtila ensin; ikkunan lista ryhmittyy työtiloittain kuten sivupalkin Käynnissä.

## Suositus

**2 Kortissa, ja muille nappi piiloon.** Rajaan törmätessä ihminen
päättää yhden asian: mikä saa väistyä. Paras ehdokas on se, johon hän ei
ole koskenut pitkään aikaan, ja järjestys "milloin kirjoitit viimeksi"
nostaa sen kärkeen ilman ikkunaa tai ryhmittelyä; kuvassa unohtuneet
taustaprosessit (`python fetch_stars.py`, `npm run dev`) tulevat ensin
ilman, että lajia tarvitsee erikseen valita. Kolme riviä ja *Näytä kaikki
12* pitävät kortin lyhyenä myös rajalla 32. Lajit (1) ja työtilat (3)
kertovat jakauman, mutta vievät ikkunaan, jossa sama päätös on vasta
edessä; työtila on hyödyllinen ryhmä, kun haluaa lopettaa yhden projektin
kokonaan, mikä on harvinaisempaa kuin yhden vapauttaminen.

*Muuta rajaa* muulle kuin ylläpitäjälle: suosittelen piilottamista, vaikka
Jari kallistui pois käytöstä olevaan. Kortin lause sanoo jo *Ylläpitäjän
asettama raja*, joten tieto siitä, kuka rajan päättää, ei katoa. Pois
käytöstä oleva painike kertoo yleensä tilapäisestä esteestä, jonka voi
poistaa; tämä ei poistu koskaan, ja se vie rivin jokaisesta
kieltäytymisestä (puhelimessa kaksi riviä, kuva
`evidence/r2-3-tyotiloittain-0-muu-pois-kaytosta-390-dark.avif`).

## Mitä host-tietoja näkymä olettaa

- **Lista ja pysäytys** kuten kierroksessa 1: `classify`
  (`internal/daemon/pi_activity_linux.go`) antaa kiireiset lajeineen, ja
  prosessin komento ja kesto tulevat Pi:n prosessisillasta.
  Kieltäytyminen `capacity_exceeded` tarvitsee listan mukaansa tai
  lukureitin.
- **"Kirjoitit viimeksi"** (riffi 2 ja 3) on henkilön viimeisimmän viestin
  aika natiivissa sessiohistoriassa; uutta tilaa ei tarvita, mutta daemonin
  pitää lukea se kiireisille keskusteluille. Riffi 1 tarvitsee vain lajin
  ja keston.
- **Raja kortissa.** Kortti sanoo luvun (12) ja että sen asetti
  ylläpitäjä, joten kieltäytymisen pitää kertoa voimassa oleva raja ja
  onko se ylläpitäjän vai daemonin oletus (32). Ylläpitäjän luku viedään
  daemonille rootin kirjoittamana tietona, ei selaimen pyynnössä (valtuus,
  päätetään ennen toteutusta, kuten kierros 1 totesi).
- **Kuka on ylläpitäjä** tulee jo `/api/v1/server`-vastauksen
  `administrator`-kentästä; nappi ei tarvitse uutta tietoa. Kierros ei nimeä
  ylläpitäjää muille, koska selain ei saa ylläpitäjien nimiä muille kuin
  ylläpitäjälle.
- **Ylläpidon yläraja 32** on daemonin muistisuoja (noin 210 MiB lasta
  kohden, 32 ≈ 7 GiB); osio näyttää valitun luvun muistiarvion.

## Kysymykset Jarille

1. *Muuta rajaa* muulle kuin ylläpitäjälle: piilossa
   (`evidence/r2-1-lajeittain-0-muu-piilossa-1440-light.avif`) vai pois
   käytöstä syineen
   (`evidence/r2-1-lajeittain-0-muu-pois-kaytosta-1440-light.avif`)?
   Ylläpitäjän näkymä: `evidence/r2-1-lajeittain-0-oletus-1440-light.avif`.
2. Mikä lista: lajeittain ikkunassa
   (`evidence/r2-1-lajeittain-1-ikkuna-1440-light.avif`), kortissa
   unohdetuin ensin (`evidence/r2-2-kortissa-0-oletus-1440-light.avif`) vai
   työtiloittain ikkunassa
   (`evidence/r2-3-tyotiloittain-1-ikkuna-1440-light.avif`)?
3. Saako ylläpitäjä nostaa rajan yli daemonin oman 32:n, vai onko 32
   katto (`evidence/r2-1-lajeittain-4-yllapito-1440-light.avif`, *Palvelimen
   oma oletus ja yläraja on 32*)?

## Tarkistus

`check.mjs`: 280 tarkistuspistettä, konsoli puhdas. Kolme riffiä 1440 px ja
390 px (kosketus), vaaleana ja tummana: kortti ylläpitäjälle ja kahdella
tavalla muulle, uudelleenyritys täynnä, lista riffin tavalla, pysäytys,
*Tilaa on nyt* ja uusi keskustelu käynnissä; riffissä 1 lisäksi
ylläpitäjän henkilökohtainen raja. Kuvat kertoimella 2 hakemistossa
`evidence/` etuliitteellä `r2-` (AVIF). Kaikki on synteettistä.

Näkymä:

```
cd ~/src/open-habitat
node design-system/prototypes/rounds/2026-11-06-samanaikaiset-keskustelut-2/build.mjs
tw browser-open design-system/prototypes/dist/samanaikaiset-keskustelut-2/offline.html
```
