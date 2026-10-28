# Tulos: kansiotarjouksen tiedostorivit

Prototyyppi on `prototypes/folder-offer-file-rows/index.html`, ja se on
rakennettu kierroksesta
`design-system/prototypes/rounds/2026-10-28-kansion-tiedostorivit/`. Tiedosto
on yksi offline-HTML, joka on koottu prototyyppikirjastosta. Siinä ei ole
tuotantokomponenttien bundlea. Opas on `prototypes/folder-offer-file-rows/NOTES.md`,
ja kuvat ovat `prototypes/folder-offer-file-rows/evidence/`-hakemistossa
laitteen skaalauksella 2.

`verify.mjs` käy läpi kolme suuntaa työpöydällä (1440 px) ja puhelimessa
(390 px), vaaleana ja tummana. Se tarkistaa, että:

- paneelissa ei ole valitun tiedoston isoa esikatselua;
- ylimmät kansiot ovat auki ja sisäkkäiset kiinni, ja sisäkkäiset aukeavat;
- jokaisen rivin esikatselu ja lataus löytyvät. Leijuvassa tämä tarkistetaan
  osoittimella ja näppäimistön fokuksella, ja puhelimessa painikkeet näkyvät
  aina. Näkyvässä painikkeet näkyvät aina. Avautuvassa ne löytyvät avatusta
  rivistä, ja kerrallaan on auki vain yksi rivi;
- `.indd`-tiedostolla ei ole esikatselupainiketta;
- haku toimii kansioiden yli ja näyttää osuman kansion;
- Esc sulkee ensin dialogin ja sitten paneelin, ja fokus palaa avaajaan;
- kortti avaa paneelin uudelleen;
- mikään ei vuoda vaakasuunnassa, valitsin pysyy paikallaan, eikä konsolissa
  näy virheitä tai verkossa pyyntöjä.

Myös kirjaston `check.mjs` menee läpi ilman virheitä.

Nykytila on luettu koodista: `web/src/components/FileOffer.tsx` (`FileShelf`,
`FileOfferCard`, `Thumb`, `fileFacts`), `FileOffer.css`, `ViewPanel.css`,
`web/src/app/ViewHost.tsx` (`ShelfPane`, joka valitsee kortista avattaessa
tarjouksen ensimmäisen tiedoston), `web/src/app/fileOffers.ts` ja
`internal/daemon/fileoffers_linux.go` (reitit ja manifestin kentät). Labia ei
ajettu. Muutos koskee yhtä paneelia, jonka rakenne näkyy koodista suoraan.

## Akseli: missä ja milloin rivin toiminnot näkyvät

| # | Suunta | Mitä se päättää | Milloin se on oikea | Mitä se maksaa |
|---|---|---|---|---|
| 1 | Leijuva | Yksirivinen rivi. Rivin painaminen avaa esikatselun. Esikatsele ja Lataa tulevat koon paikalle osoittimella tai fokuksella. Kosketuslaitteella ne näkyvät aina, ja koko siirtyy nimen alle. | Kun tiedostoja on paljon ja lista halutaan tiiviiksi. Pikkukuva ja nimi riittävät tunnistamiseen, ja yleisin teko (katso) on yksi painallus. | Työpöydällä lataus ei näy ennen osoitinta, joten se pitää löytää. Kahdella syöttötavalla on kaksi ulkoasua. |
| 2 | Näkyvä | Jokaisella rivillä on aina nimi, tyyppi, mitat ja koko sekä kaksi painiketta. Rivi itse ei ole kontrolli. | Kun löydettävyys on tärkeämpää kuin tiiviys, ja tiedot (mitat, rivimäärä) halutaan nähdä vertailematta. | Lista on työpöydällä noin viidenneksen pidempi, ja 54 rivin silmä- ja latausikonit toistuvat. Pikkukuvan painaminen ei tee mitään, vaikka sitä odottaisi. |
| 3 | Avautuva | Rivi näyttää nimen ja koon. Painettu rivi aukeaa paikallaan tiedoiksi ja nimetyiksi painikkeiksi. Kerrallaan on auki yksi rivi. | Kun tiedostoa halutaan tarkastella (kansio, tiedot, miksi esikatselua ei ole) ennen kuin sille tehdään mitään. | Jokainen lataus ja esikatselu vaatii kaksi painallusta. Avattu rivi siirtää alla olevia rivejä. |

## Host-tiedot, joita suunnat tarvitsevat

Mikään suunta ei tarvitse daemonin, gatewayn tai provisionin muutosta, eikä
sopimus (`contracts/v1/`) muutu. Kaikki tarvittava on jo selaimessa.

| Tieto tai rakenne | Onko olemassa |
|---|---|
| Tiedoston esikatselu- ja latausreitit (`inline`, `download`) | **On.** `inlineURL` ja `downloadURL` `fileOffers.ts`:ssä. |
| Koko tarjouksen zip | **On.** `zipURL`, `GET /api/v1/file-offers/<id>/zip`. Kansiokohtaista zipiä ei ole, eikä mikään suunta tarvitse sitä. |
| Tiedoston laji, koko, mitat, rivit ja sarakkeet (Näkyvä, Avautuva) | **On** manifestissa (`FileOfferItem`), ja `fileFacts` kokoaa ne. Sivumäärää ei ole, joten sitä ei näytetä. |
| Lajin esikatselun nimi (Näytä isona, Lue …) ja tieto siitä, ettei esikatselua ole | **On.** `kinds[...].action` `FileOffer.tsx`:ssä. |
| Sisäkkäiset kansiot | **On** polkuina. Puu johdetaan selaimessa `item.path`ista. Tuotanto ryhmittelee nyt litteästi koko kansiopolun mukaan. |
| Esikatseludialogi | **On.** `OfferedFilePreview` / `AttachmentPreview`. Leijuvassa rivin painaminen avaa dialogin myös tiedostolle, jota selain ei osaa näyttää. **Osittain:** on tarkistettava, että `AttachmentPreview` näyttää lajille `file` selityksen ja Lataa-painikkeen. Muuten rivi lataa tai ei tee mitään. |
| Valittu tiedosto (`shelf.selected.path`) ja ensimmäisen tiedoston automaattinen valinta | **Poistuu.** `ShelfPane`n efekti ja `FileShelf`in `selected`/`onSelect`-polku jäävät tarpeettomiksi. Kortista avattaessa riittää tarjouksen tunniste, jotta paneeli voi vierittää tarjouksen kohdalle. |
| Kosketuksen tunnistus (Leijuva) | Ei host-tietoa. CSS `@media (hover: none)` ja paneelin kapea leveys. |

## Suositus

**Leijuva (1).** Se on suoraan se, mitä Jari kuvasi: pikkukuvat riittävät, ja
rivin omat painikkeet näkyvät, kun osoitin on rivillä. Kosketuksella painikkeet
näkyvät aina. Rivi pysyy yksirivisenä, joten 54 tiedoston kansio mahtuu
selattavaksi ilman kahden rivin kohinaa. Yleisin teko, katsominen, onnistuu
yhdellä painalluksella mihin tahansa riviin. Lataus on kahden painalluksen
päässä myös esikatselun kautta, joten työpöydällä piilossa oleva painike ei
jää ainoaksi reitiksi.

Näkyvä on turvallisin löydettävyyden kannalta, mutta toistuvat ikonit ja
tietorivit tekevät pitkästä listasta raskaan. Avautuva on rauhallisin, mutta
kaksi painallusta jokaiseen tekoon on liikaa paneelissa, jonka ainoa tehtävä
on katsoa ja ladata.

Toteutus, jos tämä valitaan:

1. `FileShelf`istä poistetaan `ah-file-shelf-detail`, samoin `selected`- ja
   `onSelect`-polku. Paneelin rivi muuttuu esikatselupainikkeeksi, ja sen
   rinnalle tulevat rivin omat Esikatsele- ja Lataa-kontrollit.
2. `ShelfPane` lakkaa valitsemasta ensimmäistä tiedostoa ja vierittää
   tarjouksen kohdalle, jos se ei ole ylin.
3. Kansioryhmät muutetaan sisäkkäisiksi, avattaviksi kansioiksi (ylin taso
   auki).
4. Lajin `file` rivi: tarkistetaan, mitä `AttachmentPreview` näyttää. Jos se
   ei anna selitystä ja latausta, rivin painaminen lataa tiedoston.

## Päätökset myöhempää tarkistusta varten

- **Kansiot ovat sisäkkäin, ja vain ylin taso on aluksi auki.** Tuotanto
  näyttää jokaisen kansiopolun omana litteänä ryhmänään. Vaihtoehto on pitää
  litteät ryhmät tai avata kaikki. Valitsin puun, koska kansiossa, jossa on
  monta alikansiota, litteät ryhmät toistavat polkua ja venyttävät listaa.
  Puu johdetaan poluista ilman host-muutosta.
- **Esikatseludialogissa ei ole selausta edelliseen ja seuraavaan kuvaan.**
  Tuotannossakaan sitä ei ole. Kun iso esikatselu poistuu, kuvien läpikäynti
  dialogissa voisi olla hyödyllinen, mutta se on oma ominaisuutensa eikä
  kuulu tämän kierroksen akseliin.
- **Rivin oma painike on ikoni (silmä), jonka nimi on lajin teko** (Näytä
  isona, Lue, Näytä taulukko …). Vaihtoehto olisi sama sana kaikille
  ("Esikatsele"). Valitsin tuotannon lajikohtaiset nimet, koska ne ovat jo
  kortilla ja dialogissa käytössä.
- **Leijuvassa painikkeet korvaavat koon samassa kohdassa.** Vaihtoehto on
  pitää koko näkyvissä ja tuoda painikkeet sen viereen. Tämä vaihtoehto
  kaventaa nimeä hoverissa ja saa sen hyppimään.
- **Avautuvassa auki voi olla vain yksi rivi.** Usean rivin salliminen
  tekisi listasta nopeasti sekavan.
- **Esc tyhjentää ensin hakukentän (selaimen oma toiminta) ja vasta sitten
  sulkee paneelin.** Tuotannossa Esc sulkee paneelin mistä tahansa sen
  kontrollista.
- **Kosketuslaitteella Leijuvan painikkeet ovat 40 px.** Rivi on silloin
  48 px korkea, jotta kahden painikkeen ja rivin painallus eivät osu
  vahingossa toisiinsa.

## Kysymykset Jarille

1. Mikä suunta: Leijuva, Näkyvä vai Avautuva? Suositus on Leijuva.
2. Kelpaako sisäkkäinen kansiopuu, jossa ylin taso on aluksi auki?
3. Halutaanko esikatseluun kuvien selaus (edellinen ja seuraava) omana
   työnään?
