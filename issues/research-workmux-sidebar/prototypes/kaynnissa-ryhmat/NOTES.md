# Käynnissä ryhmiteltynä · Kierros 1

Avaa `index.html` selaimessa (offline, yksi tiedosto). Suunnat vaihtuvat
näppäimillä 1–3 tai ←/→. Yläreunan *Tilanne*-valinta vaihtaa ison rupeaman
ja hiljaisen illan välillä, ja *Alusta* palauttaa alkutilan.

## Mistä on kyse

Kun rupeamassa on kahdeksan workeria, jokainen niistä on oma rivinsä
Käynnissä-osiossa (päätös: worker ei ole vanhempansa alla). Lista kasvaa
noin neljääntoista riviin, ja työtilat putoavat ruudun alle. Sivupalkki ei
enää kerro yhdellä silmäyksellä, mitä on menossa.

workmux ratkaisee saman ongelman ryhmittelemällä agentit projekteittain.
Ryhmän otsikossa on lukumäärä, ja hiljaiset agentit taitetaan ryhmän loppuun
yhden rivin taakse. Kokonaan hiljaiset ryhmät painuvat STALE-viivan alle.
Kansio, jossa olet, ei koskaan katoa näkyvistä, ja alalaidan `↓ N more`
kertoo, montako riviä on näkymän alla. Tutkimusraportti kertoo yksityiskohdat
(`../../report.md` §1.4).

## Mikä on kaikissa suunnissa samaa

- Sinun vuorosi on ennallaan.
- **Jokaisella rivillä näkyy aika viimeisestä muutoksesta** (4 min, 2 h,
  1 pv). Host ei julkaise tätä tietoa tänään, joten toteutus tarvitsee sen
  ensin (raportin idea 2).
- **Hiljainen** tarkoittaa keskustelua, joka on odottanut viestiä yli tunnin.
  Raja on oma valintani; workmuxin oletus on tunti.
- **Avattu keskustelu ei koskaan taitu piiloon.** Kokeile: avaa
  *Mobiilinäkymän otsikko* taitteesta ja sulje taite. Rivi jää näkyviin.
- **↓ N lisää** sivupalkin alalaidassa kertoo, montako riviä on näkymän
  alapuolella. Painallus vierittää alaspäin.
- Uuden vastauksen avaaminen siirtää keskustelun Sinun vuorosi -osiosta
  Käynnissä-osioon, kuten nyt.

## Suunnat

1. **Ryhmät.** Käynnissä-osion sisällä on otsikko jokaiselle työtilalle,
   esimerkiksi *kasvimaa 9*. Rivin toiselta riviltä jää työtilan nimi pois,
   koska otsikko kertoo sen. Hiljaiset rivit taittuvat ryhmän loppuun
   (*2 hiljaista*). Työtila, jossa kaikki on hiljaista, on *Hiljaiset · yli
   tunnin* -viivan alla yhtenä rivinä (*kotisivu*). Otsikko pysyy ylhäällä,
   kun vierität ryhmän läpi. Tämä on lähinnä workmuxia.
2. **Kooste.** Käynnissä pysyy litteänä, ja keskustelut ovat omia rivejään.
   Työtilan workerit kootaan kuitenkin yhdeksi riviksi *8 workeria ·
   kasvimaa · 6 työskentelee · 2 odottaa viestiä*, joka avautuu paikallaan.
   Tämä poikkeaa päätöksestä, jonka mukaan worker on oma rivinsä. Rivi on
   yhä olemassa, mutta se on taitettu.
3. **Työtiloissa.** Käynnissä-osiota ei ole. Elävät keskustelut ovat oman
   työtilansa alla aakkosellisessa työtilalistassa yksirivisinä, ja
   hiljaiset taittuvat. Sivupalkissa on silloin kaksi osaa: Sinun vuorosi
   ja työtilat. Tämä muuttaa nykyistä sääntöä, jonka mukaan sivupalkki ei
   luettele keskusteluja työtilan alla. Valmiit keskustelut eivät
   kuitenkaan tule näkyviin, vain elävät.

## Mitä kannattaa kokeilla

- Rupeama-tilanteessa: mikä suunnista kertoo nopeimmin, että kasvimaassa
  työskentelee kuusi workeria ja kaksi on jäänyt odottamaan?
- Avaa hiljainen worker taitteesta ja sulje taite.
- Avaa *Kuvien pakkaus* Sinun vuorosi -osiosta ja katso, mihin se siirtyy.
- Puhelimessa: avaa valikko ja vieritä. Kokeile myös ↓ N lisää.
- Hiljainen ilta: tuntuuko ryhmittely turhalta, kun keskusteluja on vähän?

## Kysymykset sinulle

1. Mikä suunta?
2. Onko tunti oikea raja hiljaiselle? Lasketaanko Odottaa taustatyötä
   koskaan hiljaiseksi? Tässä ei lasketa, koska taustatyö on käynnissä.
3. Kooste-suunnassa worker katoaa riviltä taitteen taakse. Sopiiko tämä
   päätökseen, jonka mukaan worker on oma rivinsä, vai rikkooko se sen?
4. Pitääkö taitteiden pysyä auki sivun latauksen yli? Tässä ne eivät pysy.
   workmux pitää ne tmux-palvelimessa, ja meillä se olisi selaimen
   näkymäasetus.
