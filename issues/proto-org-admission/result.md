# Tulos: Pääsy organisaation kautta, kierros 1

Kierros: `design-system/prototypes/rounds/2026-11-02-organisaation-paasy/`
(`NOTES.md` kertoo rakentamisen ja tarkistuksen). Kuvat ovat `evidence/`-hakemistossa,
otettu kertoimella 2: `d1/d2/d3-oletus-*` (suuntien oletusnäkymät),
`yhdista-*`, `irrota-*`, `kirjautuminen-ei-paasya-*` ja
`kirjautuminen-lahti-*`, työpöytä vaalea ja tumma sekä 390 px.

## Akseli ja suunnat

Akseli: missä ryhmä elää pääsysivulla.

1. **Ryhmä listassa**: tiimi on yksi rivi henkilölistan alussa, ja jokaisen
   rivin tiedoissa lukee, tuliko hän tiimin kautta. Muutos tämänpäiväiseen
   sivuun on pienin. Ryhmä on kuitenkin rivi muiden joukossa, vaikka se ei
   ole henkilö, eikä listaa voi suodattaa lähteen mukaan.
2. **Lähteet erikseen**: oma Pääsyn lähteet -kortti tiimille ja
   yksittäisille, ja henkilölista jaettu osiin lähteen mukaan (Tiimin
   kautta, Henkilöinä, Pääsy päättynyt). Ryhmän tilalla on oma paikka
   (jäsenmäärä, viimeisin tarkistus, myöhemmin myös epäonnistunut
   tarkistus), ja yhdellä silmäyksellä näkee, kuka on talossa minkäkin
   lähteen kautta.
3. **Syy riveillä**: ei erillistä tiimiosiota; Salli-kenttä ottaa myös
   `organisaatio/tiimi`-nimen, rivien sirut kertovat pääsyn syyt ja lähtijä
   nousee ilmoitukseksi listan yläpuolelle. Tämä on tiivein ja näyttää
   kahdesta syystä tulevan henkilön selvimmin, mutta ryhmän tila jää
   yhdeksi pieneksi riviksi.

**Suositus: Lähteet erikseen.** Ryhmä on eri asia kuin henkilö: se voi
epäonnistua (GitHub ei vastaa, organisaatio rajoittaa sovelluksia), ja silloin
ylläpitäjän pitää nähdä se yhdestä paikasta. Osiin jaettu lista vastaa myös
suoraan kysymykseen, kuka tuli ryhmän kautta ja kuka henkilönä. Suunnasta 3
kannattaa ottaa sirut niille, joilla on kaksi syytä (nyt teksti
"Tiimin kehitys kautta ja henkilönä").

## Mitä kaikki suunnat päättävät samoin

- Lähteminen jäädyttää, ei poista. Se tekee saman kuin nykyinen Poista
  pääsy: kirjautuminen estyy, avoimet istunnot päättyvät, agentit
  pysäytetään, ja Unix-tili ja tiedostot jäävät. Tilin poistaminen on
  edelleen komentorivityö, koska provisiointibroker vain luo tilejä.
- Henkilönä sallittu pitää pääsynsä, vaikka lähtisi ryhmästä. Lähtijän voi
  palauttaa valinnalla Salli henkilönä.
- Tiimin kautta tullutta ei poisteta Habitatista. Hänet poistetaan tiimistä
  GitHubissa, jotta Habitat ja GitHub eivät kerro eri asiaa.
- Kun ryhmä yhdistetään, jo henkilönä sallitut jäsenet siirretään oletuksena
  tulemaan ryhmän kautta. Tällöin heidän pääsynsä päättyy, kun he lähtevät.
  Valinnalla he pysyvät myös henkilöinä.
- Irrotettaessa tiimin kautta tulleiden pääsy päättyy, tai valinnalla heistä
  tulee henkilöinä sallittuja.
- Kirjautumisnäkymä: vieras saa yleisen viestin, jossa ryhmää ei nimetä.
  Lähtijälle kerrotaan päivä, tiimi ja se, että tili ja tiedostot ovat
  tallessa.

## Oletetut host-tiedot

Rinnakkainen tutkimus (`research-org-admission`) ei ollut laskeutunut
mainiin, kun kierros valmistui. Näkymä olettaa seuraavat asiat:

- Lähde on GitHub-organisaatio ja sen tiimit. Gateway pyytää jo nyt
  kirjautuessa `read:org`-oikeuden (`internal/gateway/github.go`), joten se
  voi kirjautumishetkellä lukea henkilön omat organisaatio- ja
  tiimijäsenyydet tämän omalla tokenilla, myös yksityiset jäsenyydet.
  Contosoin todellinen lähde voi olla toinen (Google Workspace,
  Microsoft 365).
- Organisaatio ei rajoita OAuth-sovelluksia, tai se on hyväksynyt Open
  Habitatin. Muuten jäsenyys ei näy, ja vieraan viesti neuvoo tarkistamaan
  asian.
- Lähteminen huomataan myös kirjautumisten välillä: tunnin välein tehtävä
  tarkistus tai webhook. Se vaatii hostilta valtuuden, jota nyt ei ole,
  esimerkiksi organisaatioon asennetun GitHub Appin (members: read). Tämä on
  arkkitehtuuripäätös, ei näkymän yksityiskohta.
- Jäsenlista on saatavilla, joten myös ei vielä kirjautuneet jäsenet
  näkyvät.
- Epäselvä tarkistus (GitHub ei vastaa) ei poista ketään. Vain varma "ei
  jäsen" päättää pääsyn. Kirjautuminen ilman vastausta epäonnistuu
  turvallisesti.
- Pääsyn päättyessä agentit pysäytetään. Nykyinen Poista pääsy lupaa vain,
  että istunnot päättyvät, joten käyttäjän palveluiden pysäyttäminen on uusi
  host-kyky.

## Kysymykset Jarille

1. Riittääkö jäädyttäminen lähtijälle (tili ja tiedostot jäävät, poistaminen
   on komentorivityö), vai pitääkö Habitatin osata myös poistaa tili ja
   tiedostot esimerkiksi säilytysajan jälkeen?
2. Saako lähteminen huomata vasta seuraavalla kirjautumisella, vai pitääkö
   pääsyn päättyä kesken istunnon? Jälkimmäinen vaatii organisaatioon
   asennettavan GitHub Appin tai webhookin.
3. Kun ryhmä yhdistetään, siirretäänkö jo henkilönä sallitut jäsenet
   oletuksena tulemaan ryhmän kautta, kuten prototyypissä?
