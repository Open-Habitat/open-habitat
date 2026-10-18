Prototyyppi: https://glasspad.example.test/p/hzksz3ozpiqcvd2xisdogvk5ba/

# Yhden työtilan tila: kierros 2026-10-17-yksi-tyotila

Kierros on `design-system/prototypes/rounds/2026-10-17-yksi-tyotila/`, ja sen
rakentaa `node build.mjs rounds/2026-10-17-yksi-tyotila`. Suunnat ovat
Etusivulla, Sivupalkissa ja Yläpalkissa.

**Akseli: missä yksi työtila itse asuu**, eli sen nimi, polku, Git ja omat
toiminnot, ja kuinka paljon kehystä jää jäljelle.

## Sama kaikissa suunnissa

- Työtila on `aurinkokello`, ja sen keskustelut, katsauskortit, Valmiit ja
  Arkisto ovat samat.
- Palvelimen nimen paikalla on työtilan nimi, ja nimi vie etusivulle.
  Etusivu-riviä ei ole, koska nimi hoitaa sen tehtävän. Palvelin
  (`open-habitat-test`) ja yhteyden tila siirtyvät tilivalikkoon. Nimen
  vieressä on yhteyden pieni piste, ja ruudunlukija saa sen tekstinä.
- Keskustelun yläpalkista puuttuu työtilalinkki, koska se vain toistaisi
  otsakkeen.
- Sivupalkissa ei ole suodatinta, Työtilat-otsikkoa eikä työtilaryhmää.
  Keskustelut ovat suoraan listana huomiojärjestyksessä, ja valmiit taittuvat
  Valmiit-rivin taakse.
- **Siirtymä monen työtilan tilaan:** Lisää työtila avaa lyhennetyn
  kloonausdialogin. Varsinainen valitsin on kierroksen `2026-10-17-repon-valinta`
  asia. Kun `reitti` on kloonattu, kehys vaihtuu kirjaston nykyiseen monen
  työtilan sivupalkkiin (palvelin, Etusivu, suodatin, ryhmät), ja etusivusta
  tulee Työtilat-yleisnäkymä. Sivupalkki liukuu esiin 220 ms. Uusi työtila
  korostuu hetken sekä sivupalkissa että etusivulla, ja ilmoitus kertoo,
  miksi näkymä muuttui. Palvelimen nimikin vie monen työtilan tilassa
  etusivulle (`rail-home-and-hover`).
- **Paluu yhden työtilan tilaan:** yleisnäkymän roskakoripainike ja
  vahvistusdialogi siirtävät reitin roskakoriin. Kehys palaa yhden työtilan
  tilaan, ja ilmoituksen Palauta-painike tuo reitin takaisin ja kehyksen
  monen työtilan tilaan.

## Suunnat

1. **Etusivulla.** Etusivu ja työtilasivu ovat sama sivu, ja sen otsakkeessa
   ovat nimi, polku, toteutettu Ikonirivi (kopioi, GitHub, nimi, roskakori, +)
   ja Git-nappi. Sivupalkissa ovat vain nimi, Uusi keskustelu, keskustelut ja
   listan lopussa katkoviivainen *Lisää työtila*. Suunta muuttaa toteutusta
   vähiten, koska työtilasivu on jo olemassa. Se maksaa siinä, että Lisää
   työtila on sivupalkissa näkyvillä joka päivä, vaikka sitä tarvitaan harvoin.
2. **Sivupalkissa.** Sivupalkin otsake on itse työtila: nimi, polku ja
   Git-nappi, jonka kerros aukeaa sivupalkin oikealle puolelle. Nimen vieressä
   on valikko, jossa ovat kopioi polku, GitHub, näyttönimi, *Lisää työtila…*
   ja roskakori. Etusivulla on pelkkä työ (Keskustelut, Avoimet, Valmiit ja
   Arkisto) sekä Uusi keskustelu. Git näkyy kaikkialla, myös keskustelun
   aikana. Suunta maksaa siinä, että vaihto monen työtilan tilaan muuttaa
   sivupalkin otsakkeen eniten, kun polku ja Git katoavat sieltä.
3. **Yläpalkissa.** Sivupalkkia ei ole. Yläpalkissa ovat nimi (etusivulle),
   valikko, yhteyden piste, Uusi keskustelu ja tili. Etusivulla ovat
   keskustelut ja Git-nappi. Puhelimessa ei tarvita valikkolaatikkoa.
   Keskustelusta toiseen siirrytään etusivun kautta. Suunta maksaa siinä,
   että siirtymä monen työtilan tilaan on suurin: koko asettelu vaihtuu, ja
   puhelimessa keskustelun yllä on kaksi palkkia.

## Host-tiedot, joita näkymä olettaa

- Tila johdetaan näkyvien natiivien työtilojen määrästä snapshotissa (1 vai
  yli 1). Asetusta ei tallenneta. Nolla työtilaa on nykyinen aloitusnäkymä.
- Roskakorissa olevat työtilat eivät kuulu määrään. Palautus roskakorista
  muuttaa määrää ja siis tilaa.
- Kloonauksen valmistuminen muuttaa määrää, ja kehys vaihtuu seuraavasta
  snapshotista. Kesken oleva klooni ei vielä muuta tilaa (oletus).
- Otsakkeen nimi on työtilan nimi tai näyttönimi, ei GitHubin `omistaja/repo`.
  GitHub-nimi näkyy valikossa tai työtilasivulla.

## Kysymykset Jarille

1. **Mikä suunta?** Suosittelen *Sivupalkissa*-suuntaa. Yhden työtilan
   käyttäjälle Git ja polku ovat silloin näkyvissä keskustelun aikanakin, ja
   etusivu jää pelkälle työlle. Kehyksen rakenne (sivupalkki + sivu) pysyy
   samana molemmissa tiloissa, joten siirtymä on pieni. *Etusivulla* on
   halvin toteuttaa. *Yläpalkissa* on puhelimessa paras, mutta tekee
   siirtymästä suurimman.
2. **Lasketaanko sivupalkista piilotettu työtila?** Oletin, että lasketaan
   vain näkyvät. Silloin piilotus voi viedä yhden työtilan tilaan, eikä
   piilotettua työtilaa näe mistään muualta kuin Asetuksista. Suosittelen,
   että piilotetut eivät laske.
3. **Viimeisen työtilan siirto roskakoriin.** Sallitaanko se, jolloin palataan
   aloitusnäkymään? Vedoksessa siirto vahvistetaan, mutta sitä ei tehdä.
   Suosittelen sallimaan sen samalla vahvistuksella.
4. **Kertooko ilmoitus tilan vaihdosta joka kerta?** Suosittelen, että
   kertoo. Vaihto on harvinainen ja muuttaa koko kehyksen.

## Kirjastoehdotukset

Kierros ei muuttanut `lib/`-hakemistoa. Jos suunta valitaan, kirjaston
`app.js` tarvitsee yhden työtilan sivupalkin piirtäjän sekä `paintRail`-
ja tilahookin. Tilivalikoksi tulee `user3` (palvelin valikossa), ja
`tb-ws` jää pois yhden työtilan tilassa.

## Tarkistus

`check.mjs` ajettiin kaikille kolmelle suunnalle vaaleana, tummana ja
puhelimessa. Lisäksi klikattiin V1:n Git- ja Lisää työtila -painikkeet sekä
V2:n ja V3:n Git, keskustelu ja työtilavalikko. Konsolissa ei ollut virheitä.
Erillinen Playwright-kulku kävi jokaisessa suunnassa työpöydällä ja
puhelimessa läpi keskustelun avauksen, kotiin palaamisen nimestä, Lisää
työtilan, kloonauksen, monen työtilan tilan, roskakorin, paluun ja Palautan.
Virheitä ei tullut.

## Jari's decision (2026-10-18)

- **Yläpalkissa.** "Git-tilan tähden tätä ei kannata sivupalkiksi vetämään. Kehyksen rakenteen samankaltaisuus on kiintoisa, mutta yhden työtilan repossa uskoisin, että Yläpalkissa on tässä tapauksessa yksinkertaisin ja käyttäjälle mieluisin. Pointtina on, että sivupalkki ei ole mikään itseisarvo."
- **The last workspace cannot be moved to the Trash.** "Tämä on varmasti usealle käyttäjälle sellainen, että tämä on ainoa missä he tekevät työtä." The trash action is not offered (or is blocked with its reason) when only one workspace remains.
- Questions 2 (hidden workspaces do not count) and 4 (notice on every mode change) were not answered; implement the recommendations and list them under Decisions for later review.
