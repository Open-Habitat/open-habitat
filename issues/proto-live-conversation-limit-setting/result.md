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
