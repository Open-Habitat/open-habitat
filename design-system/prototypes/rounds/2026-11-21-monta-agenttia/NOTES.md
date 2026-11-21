# Monta agenttia – Alicen päivä, kierros 4 (21.11.2026)

Jatkoa kierroksille `2026-11-20-alicen-paiva-a/b/c`. Jarin palaute niistä
(20.–21.11.): jokainen tarina oli yksi kaari yhden agentin kanssa. Sivulle
tulee yksi päivä, jossa Alice tekee monta asiaa ja jossa hänellä on monta
agenttia yhtä aikaa ja peräkkäin. Jokainen välähdys näyttää yhden asian, jossa
agentti oikealla koneella on aidosti kyvykkäämpi, eikä sivu vertaa mihinkään
eikä perustele ("Why a real computer" -rivit on poistettu). Päivässä ei ole
käyttöönottoa.

Tämän kierroksen kysymys on muoto, ei sisältö: miten yhden ihmisen monta
istuntoa näytetään niin, että ei-tekninen lukija ymmärtää yhdellä silmäyksellä
samanaikaisuuden (kolme käynnissä juuri nyt), järjestyksen (aamusta iltaan),
tilan (Your turn, Running, Quiet) ja syvyyden (välähdys aukeaa siihen, mitä
tapahtui: pyyntö, komennot tai ohjelmat, tulos). Päivä on kirjoitettu kerran
(`round.js`: `SESS`, `PLACES`, `G`) ja piirretty kolmeen muotoon. Yläosa on
kierroksen 2 kiinteä hero, alla lyhyt tynkä. Valitsin on `/prototype`-taidon
kelluva valitsin (`../../lib/picker.css`, `picker.js` sanatarkasti); suomenkielinen
kuvausrivi on sivun yläpuolella ja napin `title`-vihjeenä.

## Suunnat

1. **Sivupalkki.** Akseli: tuotteen oma näkymä kertoo päivän. Vasemmalla
   kymmenen askelta (kellonaika, missä Alice on, hänen pyyntönsä, mitä
   tapahtui, tilarivi); oikealla tahmea sovelluskehys, jonka sivupalkissa
   rivit liukuvat osioiden Your turn, Running ja Quiet välillä vierityksen
   mukaan (FLIP-liike, 280 ms) ja jonka keskustelu näyttää askeleen
   välähdyksen. Rivin painallus avaa sen keskustelun sellaisena kuin se oli
   sillä hetkellä (käynnissä olevasta pyyntö ja työrivi). Puhelimessa
   tahmea tilapalkki (kello, paikka, kolme laskuria); laskureista aukeaa
   sivupalkki, ja ruutu on askeleen sisällä.
2. **Kaistat.** Akseli: aika on tilaa; koko päivä yhdellä silmäyksellä.
   Jokainen keskustelu on kaista kellon 08–18 yllä (raidallinen Running,
   oranssi Your turn, ohut viiva Quiet), ylimpänä Alicen oma kaista
   (koti, raitiovaunu, studio, lounas, pakkaus Bobin kanssa), ja
   palautusten kaistan alla viisi workerin viivaa. Liukusäädin tai
   "Play the day" siirtää kursoria; lukema kertoo kellon, paikan ja
   laskurit, ja kaistojen merkit vaihtuvat. Numeroitu nasta avaa välähdyksen
   kaavion alle (Earlier/Later). Puhelimessa aika kulkee alaspäin ja kaistat
   ovat sarakkeita; lukema ja säädin pysyvät näkyvissä.
3. **Hetket.** Akseli: päivä erillisinä hetkinä kuin sarjakuvan ruutuina.
   Kahdeksan korttia (08:22–17:32), kussakin kellonaika, paikka, sivupalkki
   pienenä juuri sillä hetkellä ja yksi lause; hetken välähdykset ovat
   numeroituina nappeina ja korostettuina riveinä. Painallus avaa välähdyksen
   dialogiin; nuolet selaavat välähdyksiä dialogin sisällä (eivät käännä
   valitsinta), Esc sulkee. Puhelimessa kortit allekkain ja dialogi koko
   ruudun.

## Päivä: Alice, Example Studio (käsinpainettu pellava, verkkosivu, henkilöstön käsikirja; Bob hoitaa tilaukset ja toimittajat)

Kahdeksan keskustelua (agenttia) ja viisi workeria. Samanaikaisuus: 08:30–08:34
kolme käynnissä raitiovaunussa; lounaalla palautukset käynnissä välilehti
kiinni ja kuitit odottavat. Illalla uutiskirje jää odottamaan lupaa.

| # | Aika | Keskustelu | Välähdys | Pinon etu (VIESTI A) | Ominaisuus (VIESTI B) |
|---|---|---|---|---|---|
| 1 | 08:04 | What’s waiting today | Eilisen muistiinpanot, yön posti ja kalenteri yhdeksi listaksi | 8 muisti tiedostoissa, 11 omat tilit | sivupalkki, yhteydet (Gmail, kalenteri) |
| 2 | 08:34 | Northside prices | Viime viikolla kirjoitettu katetarkistin Bobin uudelle hinnastolle; viesti Bobille hänen sanastaan | 4 työkalu jää, 2 laskee ohjelmalla | rakenna omaa päälle, liitteet postista |
| 3 | 08:41 | October receipts | 1 284 viestiä haettu, 23/26 kuittia täsmätty ohjelmalla, nimetty ja arkistoitu; kolme kysytään | 1 hakee ei arvaa, 2, 5 ketju | yhteydet, kuittien kansio |
| 4 | 09:02 | Market video | Leikkeet läppäriltä, ffmpeg puuttuu, agentti asentaa sen omaan tiliinsä ilman pääkäyttäjää, 30 s video tekstityksin | 3 ohjelmakirjasto ja asennus | oma tietokone, näkymä (video), tarjottu tiedosto |
| 5 | 09:44 | Shipping banner | "Kuka laittoi tämän ja miksi?" Sivun historia: Bobin agentti tiistaina Bobin perustelulla; loppupäivä lisätään ja julkaistaan Alicen "Yes"-sanalla | 9b historia näyttää kollegan agentin teot | jokaisella omansa, Gitea |
| 6 | 12:38 | October receipts (puhelin) | Lounaalla: tilannekatsaus, saneltu vastaus, toinen postilaatikko (IMAP), viesti Bobille | 6 työ jatkuu ilman ihmistä, 11 | puhelin, sanelu, yhteenveto, IMAP |
| 7 | 13:35 | Returns: 30 days | Pääagentti jakaa työn viidelle: yksi lukee 212 asiakasviestiä, kolme kirjoittaa kukin oman osansa puhtaalta pöydältä, viides toisella mallilla tarkistaa ja palauttaa kaksi | 7 orkestrointi, kontekstin hallinta, vertailu | workerit, välilehti kiinni, näkymä (muutokset) |
| 8 | 14:30 | December newsletter | Alice muuttaa mielensä kesken työn; 386 vastaanottajaa lasketaan tiedostosta, ja lista kertoo jokaisen pois jätetyn syyn; mitään ei lähetetä ilman lupaa | 2, 12 väitteet tarkistettavissa | ohjaa kesken työn / jonotettu viesti, näkymä, tarjottu tiedosto |
| 9 | 15:30 | Returns: 30 days | Bobin sanasta yksi sivu takaisin ennalleen, muut 16 jäävät; peruminen kirjautuu | 9 jokainen muutos tallessa ja peruttavissa | keskustelu, muutos ja Undo |
| 10 | 17:28 | Before I go | Päivän opit kirjoitetaan: kolme vain Alicelle (`~/AGENTS.md`), kolme koko tiimille (`team/AGENTS.md`), jonka Bobin agentti lukee huomenna | 10 oppi jää oikeaan paikkaan | jokaisella omansa, yhteinen kansio |

Ei mukana: terminaali ja editori (B:n viimeinen rivi). `wrap-up` ei tule
tuotteen mukana (VIESTI A10); tässä Alice pyytää sitä omin sanoin, joten sivu ei
väitä sitä tuotteen ominaisuudeksi. Päätettävä, jos suunta jatkuu.

## Mitä ruudut olettavat tuotteesta

- Valmiit yhteydet: Gmail ja Google-kalenteri (`gog`), IMAP (`himalaya`), Gitea
  (sivun repo), Alicen oma läppäri (`computer`-rivi). Ei Trelloa, Slackia,
  Teamsia, Jiraa eikä Confluencea; ei SharePoint-kirjoitusta.
- Mitään ei ajeta ajastetusti: Alice käynnistää jokaisen keskustelun.
- Agentti ei lähetä eikä muuta mitään omien tiedostojensa ulkopuolella ilman
  lupaa: viestit Bobille lähtevät Alicen sanasta ("Send…", "ask him"), sivu
  julkaistaan vasta "Yes"-vastauksen jälkeen, uutiskirje odottaa.
- ffmpeg asennetaan staattisena ohjelmana `~/.local/bin`iin ilman
  pääkäyttäjää. Se, mitä tavallisen käyttäjän agentti saa oikeasti
  asennettua, on yhä tutkittavana (VIESTI A3); ffmpeg on valittu, koska
  staattinen binääri ei tarvitse järjestelmäkirjastoja.
- Workerin "toinen malli" olettaa, että worker voi käyttää eri mallia.
- Komentorivit ovat havainnollisia, eivät labista kaapattuja.
- Ihmiset, yritykset ja osoitteet ovat keksittyjä (Example Studio, Alice,
  Bob, Kirsi, Northside, Fjord Fonts; `example.org`).

## Rakentaminen ja tarkistus

```
TMPDIR=<oma scratch> node design-system/prototypes/rounds/2026-11-21-monta-agenttia/build.mjs <out.html>
PROTO_WEB=<web-hakemisto, jossa node_modules> \
  node design-system/prototypes/rounds/2026-11-21-monta-agenttia/check.mjs <out.html> <kuvahakemisto>
```

`build.mjs` tarvitsee ImageMagickin (`convert`, `identify`) heron kuvaan;
ruudut ovat HTML:ää, joten tulos on noin 0,5 Mt. `check.mjs`:n tarkistukset on
lueteltu sen alussa: jokainen suunta 1440 ja 390 px:n leveydellä, jokainen
vuorovaikutus klikattuna, sivu loppuun asti ja konsoli puhtaana.
