# Liitteen torjunta

## Kierros 1: nykytila ja kolme esitystä

Kierros: `design-system/prototypes/rounds/2026-11-08-liitteen-torjunta/`.
`NOTES.md` kertoo nykytilan ja suuntien erot tarkemmin. Jokaisessa suunnassa
on kaksi komposeria rinnakkain: vasemmalla Jarin tapaus (yksi 34 Mt:n
video), oikealla valittu tapaus, oletuksena *Monta kerralla* (viisi
tiedostoa: kaksi kelpaa, kaksi on yli 20 Mt, yksi on tyhjä). *Oikealla*-valinta
käy läpi kaikki torjunnat, ja *Kieli* vaihtaa englantiin. Nyt on tuotannon
`Composer` muuttamattomana keksityllä hostilla. Suunnat ovat kierroksen kopio
siitä, ja kopion diff on suuntien speksi.

Akseli: missä ja missä muodossa hylätty liite kerrotaan. Sanat ja käytös
ovat kaikissa suunnissa samat.

0. **Nyt**: paljas virherivi kentän yllä; ensimmäinen hylätty tiedosto lopettaa koko pudotuksen, eikä nimeä kerrota.
1. **Varoitus**: punainen yhteinen varoitus kentän yllä: tiedoston nimi otsikkona, raja ja mitä tehdä alla; monesta tiedostosta lista.
2. **Siru**: hylätty tiedosto on punainen siru liitteiden rivissä syy sirussa; sirua painamalla näkyy raja ja mitä tehdä.
3. **Rivi**: yksirivinen punainen varoitus: nimi, syy ja mitä tehdä; monesta tiedostosta määrä ja Näytä-painike listaan.

Nykytilasta löytyi koodia lukemalla enemmän kuin kömpelö lause:

- Ensimmäinen hylätty tiedosto lopettaa pudotuksen, ja myöhemmät jäävät
  hiljaa liittämättä (`r1-d0-nyt-monta-1440-light`: `kaavio.pdf` puuttuu).
- Yli 30 tiedoston pudotus hylätään kokonaan.
- 100 MiB:n yhteisraja huomataan vasta lähetyksessä (`r1-d0-nyt-total-1440-light`).
- Katkennut yhteys näyttää selaimen englanninkielisen *Failed to fetch*
  (`r1-d0-nyt-failed-1440-light`).
- Palvelimen täysi levy (507) sanotaan epävarmaksi tallennukseksi, vaikka
  host tietää, ettei mitään jäänyt (`r1-d0-nyt-disk-1440-light`).
- Tiedostotyyppiä ei torjuta missään, joten "ei tuettu" -tapausta ei ole.

Suunnat korjaavat nämä samalla tavalla. Jokainen tiedosto tarkistetaan
erikseen, kelvolliset menevät läpi ja hylätyt nimetään. Yli 30:sta liitetään
30. Yhteisraja tarkistetaan jo liitettäessä. Hostin koodi säilyy, joten
kiintiö, levy ja yhteys sanotaan eri sanoin, ja katkenneen tallennuksen voi
yrittää uudelleen.

### Suositus

**Varoitus.** Se on se yhteinen varoitus, jota Jari vertasi, ja sen otsikko
kertoo heti, mikä tiedosto jäi pois. Torjunta on harvinainen, joten tila,
jonka varoitus vie kentän yläpuolelta, on pieni hinta. Sirussa neuvo jää
painalluksen taakse eikä se ole yhteinen varoitus. Rivi rivittyy yhdenkin
tiedoston kohdalla kahdelle riville, ja monen tiedoston syyt jäävät
painikkeen taakse. Rivi tarvitsi puhelimessa myös ohituksen kirjaston
`WarningBanner`in rivimuotoon (runko `flex-basis: 0`), mikä on ehdotus
kirjastoon, jos rivimuoto valitaan.

### Host-tiedot

Ei uutta hostin tietoa eikä rajapintaa. Rajat ovat daemonin nykyiset: 20 MiB
tiedostoa ja 30 tiedostoa ja 100 MiB viestiä kohden. Lisäksi liitteille on
1 GiB, eikä vanhoja liitteitä poisteta automaattisesti. Selaimessa
`uploadAttachment` heittäisi hostin koodin sanotun tekstin sijaan, ja 507
luettaisiin varmaksi epäonnistumiseksi. Yhteisraja lasketaan niiden
liitteiden koosta, jotka on tallennettu tältä sivulta. Palautetun
luonnoksen liitteet hylkää yhä host lähetyksessä.

### Päätökset myöhempään katselmointiin

- Liitetila täynnä: neuvo on *Pyydä agenttia poistamaan vanhat liitteet,
  joita et enää tarvitse.*, koska selaimessa ei ole liitteiden siivousta.
- Epävarma tallennus (yhteys katkesi) näytetään katkenneena ja sen voi
  yrittää uudelleen. Mahdollinen jäänne hostilla vie kiintiötä, mutta ei
  näy luonnoksessa.

### Kysymykset Jarille

1. Mikä esitys: Varoitus (`r1-d1-varoitus-monta-1440-light`), Siru
   (`r1-d2-siru-monta-1440-light`) vai Rivi (`r1-d3-rivi-monta-1440-light`)?
2. Kelpaako sanamuoto *kokous-2026-11-07.mov on liian suuri. Tiedosto on
   34 Mt, ja liite voi olla enintään 20 Mt. Pienennä tai pakkaa tiedosto,
   tai jaa se osiin.* (`r1-d1-varoitus-large-1440-light`), vai pitääkö sen
   olla lyhyempi kuten Rivissä (`r1-d3-rivi-large-1440-light`)?
3. Liitetäänkö yli 30 tiedoston pudotuksesta ensimmäiset 30 ja nimetään
   loput (`r1-d1-varoitus-count-1440-light`), vai hylätäänkö koko pudotus
   kuten nyt (`r1-d0-nyt-count-1440-light`)?
