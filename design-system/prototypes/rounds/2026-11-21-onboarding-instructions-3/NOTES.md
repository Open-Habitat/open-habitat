# Ohjeet agentille: sanat ja tiedosto (kierros 3)

Issue `new-user-agent-instructions-template`. Jari valitsi kierroksesta 2
suunnan A Keskustelu 21.11.2026, mutta piti sen tekstejä pitkinä ja
teknisinä. Lisäksi hän halusi, että tiedosto näytetään keskustelun jälkeen.
Tämä kierros pitää vaiheen käyttöönoton reitin viimeisenä pienenä
keskusteluna ja muuttaa vain sen, **mitä ihmiselle sanotaan ja miten valmis
tiedosto näytetään**. Suositus ja kysymykset Jarille ovat issuen
`result-3.md`:ssä.

- **A1 Lyhyesti**: otsikko "Kerro agentille itsestäsi", kaksi kysymystä
  mahdollisimman vähin sanoin. Lopuksi ohjeet näytetään luettavana listana,
  ja jokaisen otsikon alla lukee harmaalla, mitä kohta tarkoittaa.
- **A2 Muistilappu** (suositus): "Agentti ei muista aiempia keskusteluja.
  Tehdään sille muistilappu, jonka se lukee aina ensin." Agentti tarkistaa
  ensin GitHubista ottamansa tiedon (Kyllä, laita / Jätä pois) ja kysyy sen
  jälkeen samat kaksi asiaa. Lappu näytetään kortilla, jonka reunahuomautus
  kertoo kunkin kohdan merkityksen. Varsinainen tiedosto polkuineen tulee
  esiin vain Näytä tiedostona -painikkeella.
- **A3 Esittely**: agentti kirjoittaa ihmisen suulla lyhyen esittelyn ("Hei,
  olen Aino. …") ja näyttää sen alun jo ensimmäisessä vuorossa. Tiedosto on
  tavallista proosaa ilman otsikoita. Sen alla on yksi "Mitä tämä on?"
  -selitys, ja tekstiä voi muokata itse ennen tallennusta.

## Yhteistä kaikille

- Keskustelussa ei puhuta poluista, AGENTS.md:stä, Pi:stä eikä Claudesta.
  Vaihe sanoo, mihin ohjeita tarvitaan, ei sitä, miten ne on toteutettu.
- Tallenna tulee näkyviin vasta, kun tiedosto on näytetty. Ennen sitä
  vaiheesta pääsee eteenpäin vain Tee myöhemmin -painikkeella. Näin reitti ei
  voi päättyä tallennukseen, jota ihminen ei ole nähnyt.
- Omin sanoin kirjoitettu teksti menee tiedostoon (A1, A2: Muuta; A3:
  esittelyn loppuun), ja tiedosto päivittyy heti, myös näyttämisen jälkeen.
- Tallennuksen jälkeen näytetään yksi selkokielinen lause ("Agentti lukee
  ohjeesi jokaisen keskustelun alussa …") ja painike Siirry Habitatiin.
  Tekniset tiedot ovat suljetun "Missä ohjeet ovat?" -kohdan takana:
  polut, `write`- tai `edit`-rivit kummallekin tiedostolle ja kirjoitettu
  teksti sanatarkasti.
- Olemassa oleva tiedosto: vanha teksti näytetään harmaana otsikolla
  "Nykyiset ohjeesi", ja lisäykset on merkitty sanalla "uusi" tai vihreällä
  reunaviivalla. Kieltä ei lisätä, ja Jätä ennalleen ei kirjoita mitään.
- Pohja on sama kuin kierroksessa 2, mutta sen otsikko ja johdanto on
  kirjoitettu tavallisella kielellä ("Ohjeeni agentille. Saat muuttaa näitä
  milloin vain."). Tiedostoon ei kirjoiteta selitystä siitä, mikä ohjelma
  sen lukee.

## Keskustelu sivupalkissa: ei näy koskaan

Vaiheen Pi-sessio ajetaan kotihakemistossa (`cwd = ~`). Daemonin snapshot
(`internal/daemon/snapshot_linux.go`) liittää session sivupalkkiin vain, jos
session `cwd` on täsmälleen työtilan tai sen worktreen polku. Kotihakemiston
sessio ei siksi näy sivupalkissa nytkään, eikä sen piilottamiseen tarvita
uutta koodia, arkistointia tai erillistä merkintää. Valitsin tämän, koska:

- keskustelulla ei ole repoa, johon se kuuluisi. Sivupalkkiin ilmestyvä
  `~`-ryhmä olisi aloittelijalle outo eikä veisi mihinkään hyödylliseen;
- arkistointi on sivupalkin näkyvyystyökalu. Arkistoida ei voi sellaista,
  mikä ei koskaan näy, ja arkistointi tarvitsisi lisäksi kirjoituksen
  näkyvyystilaan;
- natiivi historia säilyy silti: sessio on tavallinen Pi-sessio, ja
  `pi --resume` kotihakemistossa löytää sen. Rinnakkaista historiaa ei
  synny eikä mitään piiloteta natiivista tilasta;
- keskustelun lopputulos on tiedosto, ja siihen pääsee Asetuksista
  (Tili › Ohjeet agentille, jota prototypoidaan rinnakkain) tai pyytämällä
  agenttia missä tahansa keskustelussa, kuten Jari päätti.

Prototyypin Habitat-näkymän sivupalkissa on siksi vain kloonattu työtila, ja
`check.mjs` tarkistaa, ettei vaiheen keskustelu näy siellä.

## Käyttö

Oletusnäkymä on viimeisen vaiheen alku, jossa muunnelmat eroavat
otsikoltaan, johdannoltaan, ensimmäiseltä vuoroltaan ja kysymykseltään.
**Hyppää valmiiseen tiedostoon** avaa vaiheen vastattuna, jolloin
tiedostonäkymät voi verrata suoraan. **Alkuun kirjautumisesta** käy läpi koko
ketjun. Teema, Kieli ja Tili (Uusi tili tai Ohjeet jo olemassa) vaihtavat
tilannetta. Osoitteessa toimivat `?theme=light|dark|contrast`, `?lang=en`,
`?scenario=existing` ja `?stage=login|reveal`.

```
node build.mjs <out-dir>          # offline.html ja index.html
node check.mjs <out-dir>/offline.html <shots-dir> [--quick]
```

`build.mjs` vaatii `web/node_modules`-hakemiston (`npm ci` hakemistossa
`web/`), ja `check.mjs` vaatii lisäksi Playwrightin Chromiumin
(`PLAYWRIGHT_BROWSERS_PATH`). Rakennus paikkaa tuotannon
`OnboardingFrame`-komponentin vaiheen nimen samalla tavalla kuin kierros 2
(selitys on `build.mjs`:ssä). Kirjastoon (`lib/`) ja tuotantokoodiin ei
tehty muutoksia.
