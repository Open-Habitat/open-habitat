# Tulos: selitystilan kaikki kortit (kierros 6)

Prototyyppi: `prototype/selitystila-kortit.html`, Jarin opas
`prototype/NOTES.md`, kuvat `prototype/kuvat/` (AVIF, kerroin 2). Lähde
on `design-system/prototypes/rounds/2026-11-03-selitystila-kortit/`, ja
kortit ovat yhdessä tiedostossa `cards.mjs` suomeksi ja englanniksi.

Kierros 5:n riffi 1 (*Himmennys ja kortti osoittimessa*, koko näyttö) on
piirretty tuotannon oikeiden näkymien päälle: synteettisestä labrasta
kaapatut 22 näkymää työpöydällä (1440) ja puhelimella (390), vaaleana ja
tummana. Tila itse on ennallaan; kierros on teksteistä.

## Inventaario

Jokainen kohta, jonka tila selittää, on kortti tunnuksineen (178 korttia).
Kohta löytyy tuotannon omasta elementistä (testitunniste tai luokka), ei
koordinaateista.

| Alue | Kortit |
|---|---|
| X Selitystila itse (nauha, palkki, Selitä tämä näkymä) | 3 |
| Y Keskustelun yläpalkki ja ⋯ | 16 |
| S Sivupalkki, tilivalikko ja Hiljaisten rajaus | 29 |
| E Etusivu | 7 |
| T Työtilan sivu | 14 |
| A Uuden keskustelun aloitussivu | 5 |
| K Keskustelu ja sen kortit (viestit, työrivi, komento, luettu/kirjoitettu/muokattu tiedosto, prosessi, epäonnistunut vaihe, tiedostolinkki, kaavio, työn tila) | 19 |
| V Viestikenttä ja taustatyön merkit | 11 |
| L Kentän listat ja mallivalitsin | 11 |
| P Paneelit: Git, Tiedot, keskustelun malli, opas, taustatyö | 15 |
| R Pääte | 9 |
| D Editori | 8 |
| W Workerin näkymä | 6 |
| M Asetukset (haku, sulkeminen, jokainen asetussivu, Git-identiteetti, versio) | 25 |

## Suunnat (vain korttien tyyli)

1. **Mitä · tiedä · kokeile**: nimi, yksi lause mitä kohta tekee sinulle,
   yksi lause mitä kannattaa tietää, Kokeile. Noin 25–35 sanaa.
2. **Yksi lause**: nimi ja yksi lause. Noin 10–14 sanaa.
3. **Opastava**: kaksi tai kolme virkettä tilanteesta lähtien, esimerkin
   kanssa. Noin 45–60 sanaa.

Suunnat on näytetty neljällä kohdalla (Pääte Y08, Konteksti Y05, Hiljaiset
S07, komentorivi K05); kaikki 178 korttia on kirjoitettu suunnalla 1.

## Suositus

**Suunta 1.**

- Toinen lause kantaa ne tiedot, joita kierros 4 piti tarpeellisina: miksi
  painike on harmaa (näkyy vain, kun kohta oikeasti on harmaa), mihin ⋯:ssa
  oleva painike on mennyt (vain ⋯:n rivillä) ja mitä säilyy. Suunnasta 2
  ne puuttuvat, ja kortti jää nimen toistoksi.
- Suunta 3 on hyvä ensimmäisellä kerralla mutta raskas, kun liikutat
  osoitinta kohdasta toiseen: 50 sanan kortti ei ehdi tulla luetuksi ennen
  kuin osoitin on jo seuraavassa kohdassa, ja puhelimella se peittää puolet
  näytöstä.
- Kortti ei toista sitä, mikä kohdassa jo lukee. Siksi asetuksissa on yksi
  kortti kullekin asetussivulle, ei jokaiselle riville: rivien kuvaukset
  ovat jo näkyvissä.

Prototyyppi toi esiin kolme toteutuksen asiaa:

- **Avoin lista tai valikko peittää.** Kun Komennot-lista, ⋯, Git-paneeli
  tai Tilivalikko on auki, selittyvät vain sen rivit, eivät alla olevat
  kohdat (778 tällaista tapausta tarkistuksessa). Se vastaa tuotantoa,
  jossa painallus listan ulkopuolelle sulkisi listan.
- **Palkki vie tilan, ei peitä.** Näkymä kutistuu 40 px palkin alle, jotta
  yläpalkki jää selitettäväksi. Toteutuksessa sama: palkki on sovelluksen
  yläpuolella, ei sen päällä.
- **Sisäänkäynti leveällä näytöllä.** Kun kaikki mahtuu yläpalkin riville,
  ⋯ puuttuu, joten *⋯ › Selitä tämä näkymä* ei aina ole olemassa.
  Prototyyppi lisää rivin *Tilivalikko › Selitä tämä näkymä*, joka on
  jokaisessa näkymässä (myös etusivulla ja asetuksissa), ja puhelimella
  lisäksi ⋯:hen.

## Toteutusta varten

- `cards.mjs` on toteutuksen sisältö sellaisenaan: siitä tulee katalogi
  `web/src/text/`-hakemistoon (tunnus, laji, nimi, lause, tiedä, kokeile,
  harmaa, ⋯-huomautus, pikanäppäin arvona). Koska `open-habitat-ui`-viite
  kootaan katalogeista, agentti ja selitystila lukevat samat tekstit.
- Kohdan valitsin on komponentin oma testitunniste tai luokka; toteutus
  merkitsee komponenttien juuret samoin, eikä koordinaatteja tallenneta.
- Kortin rivit *harmaa* ja *⋯* näkyvät vain tilanteessa, jossa ne pitävät
  paikkansa (kohta on harmaa tai kohta on ⋯:n rivi).
- Kokeile puuttuu tarkoituksella arkistoinnista, poistosta ja
  uloskirjautumisesta.
- Tarkistettava toteutuksessa, koska labra ei näytä niitä: milloin
  *Tee tilannekatsaus nyt*, *Arkistoi*, *Avaa GitHubissa* ja *Lähetä*
  ovat harmaita (kortin harmaa-rivi on kirjoitettu koodin perusteella), ja
  pitääkö *Leveys*-raahaus (P13) talteen leveyden.

Kierros ei muuttanut tuotantokoodia.

## Kysymykset Jarille

1. **Suunta 1, 2 vai 3?** Kuvat `01`/`02` (suunta 1), `03` (suunta 2) ja
   `04` (suunta 3) näyttävät saman Pääte-kortin; `23` on suunta 3
   puhelimella. Suosittelen suuntaa 1.
2. **Tilivalikko › Selitä tämä näkymä** (kuva `15`) tilan pysyväksi
   paikaksi kaikilla leveyksillä, ja puhelimella lisäksi ⋯ (kuva `19`)?
   Suosittelen.
3. **Asetuksissa kortti asetussivulle** (kuva `17`, Tekoäly), ei jokaiselle
   asetusriville? Suosittelen sivukohtaista.

## Näyttäminen

```
open-habitat agent view offer --current \
  --source issues/proto-explain-mode-r6/prototype/selitystila-kortit.html \
  --title "Selitystila: kaikki kortit – kierros 6" \
  --idempotency-key "$(uuidgen)" --json
```

# Kierros 7: painallus toimii ja keskustelun tila

Jarin päätös 6.11.: tyyli 1. Prototyyppi on
`prototype/kierros-7/selitystila-tila.html` ja opas
`prototype/kierros-7/NOTES.md`. Kuvat ovat `evidence/r7-*.avif`
(kerroin 2). Lähde on `design-system/prototypes/rounds/2026-11-06-selitystila-tila/`.
Kortit ovat yhä kierroksen 6 `cards.mjs`, ja kierroksen omat tekstit ovat
`state.mjs`:ssä.

## Mikä muuttui kaikissa riffeissä

- **Ei kiinnitystä.** Osoitus näyttää kortin, ja napsautus tekee sen, mitä
  se tekee aina. Selitystila pysyy päällä, joten avautuneen työn, tulosteen,
  päätteen tai Git-paneelin kohdat selittyvät heti (kuvat `r7-11`–`r7-13`).
  Kortin alarivi kertoo, mitä napsautus tekee. *Kokeile*-painike on
  tarpeeton, koska kohta itse on kokeilu.
- **Pysyvät teot odottavat** (`r7-14`): arkistointi, poisto,
  uloskirjautuminen, tyhjän keskustelun sulkeminen, lähettäminen,
  pysäyttäminen, päätteen sulkeminen ja tallennus. Tämä on se pieni
  käyttöliittymän muutos, jonka päätös salli.
- **Puhelin:** ensimmäinen napautus selittää ja kortissa on teko painikkeena,
  toinen napautus samaan kohtaan tekee sen (`r7-19`).
- **Tilakortti.** Kun keskustelussa ei osoita mitään, kortti kertoo tilan:
  mitä tapahtuu, mitä kannattaa tietää ja *Voit nyt* -rivit, jotka
  sytyttävät kohtansa ja tekevät sen napsautuksella (`r7-02`, `r7-10`).
  Tiloja on kuusi: ei vielä alkanut, työskentelee, odottaa sinua, pysäytit
  vuoron, vuoro epäonnistui ja työ jatkuu taustalla (`r7-04`, `r7-07`–`r7-09`).

## Riffit: miten tilan selitykseen pääsee keskustelun alun jälkeen

1. **Tilapisteestä**: yläpalkin tilapisteen omaan vihjeeseen tulee rivi
   *Mitä nyt? Selitä tilanne* (`r7-01`, puhelin `r7-15`).
2. **Selitä-painike**: pysyvä ?-painike yläpalkissa ja ?-näppäin (`r7-03`,
   puhelin `r7-17`).
3. **Tilanne tarjoaa**: kun tila on uusi, vuoron alle tulee hiljainen rivi,
   kolme kertaa per tila (`r7-05`, `r7-06`, puhelin `r7-18`).

## Suositus

**Riffi 1, Tilapisteestä.**

- Tilapiste on jo se paikka, josta tilaa kysytään: sen napautus kertoo tilan
  sanoin. Selitys jatkaa samasta kysymyksestä, eikä uutta painiketta
  tarvita.
- Riffi 2 on löydettävin, mutta se vie pysyvän paikan rivillä, jolta
  kierroksilla on juuri karsittu painikkeita. Puhelimella otsikko lyheni
  (`r7-17`).
- Riffi 3 auttaa juuri silloin, kun tila on uusi, mutta se tuo
  keskusteluun rivin, joka ei ole keskustelua. Lisäksi se vaatisi
  laskurin siitä, mitkä tilat henkilö on nähnyt: uuden tallennettavan asian
  ilman muuta tarvetta. Jos riffi 1 tuntuu liian piilossa, riffin 3 vihjeen
  voi näyttää vain *Vuoro epäonnistui* -tilassa, koska siinä tilanne on
  oikeasti epäselvä.

## Host-tiedot

- Tilakortti tarvitsee vain tilan, jonka yläpalkin tilapiste jo näyttää
  (työskentelee, odottaa sinua, epäonnistui), sekä tiedon pysäytetystä
  vuorosta ja käynnissä olevasta taustatyöstä. Ne ovat jo snapshotissa ja
  vuoron tiedoissa. Uutta host-tietoa ei tarvita.
- *Voit nyt* -rivit osoittavat olemassa oleviin kohtiin kortin tunnuksella
  (V01, K04, K18, V07, V11, Y04, Y06, A02, A05).
- Riffi 3 tarvitsisi selaimeen laitekohtaisen laskurin. Riffit 1 ja 2 eivät
  tallenna mitään.
- Kortin S02 (Yhteys) valitsin osui kierroksella 6 jokaiseen tilamerkkiin.
  Toteutuksessa se rajataan sivupalkin yhteysmerkkiin, kuten tässä.
- Kierros ei muuttanut tuotantokoodia. Ajettu Birchlla commitin `51087b9f`
  päällä (Node 22.23.2), synteettinen labra `OH_PORT_BASE=6374`. Tarkistus:
  6137 selitystä 212 näkymäyhdistelmässä ja 88 tilakorttia;
  tavoittamattomia 0, näkymän ulkopuolelle meneviä kortteja 0, konsoli
  puhdas.

## Kysymykset Jarille

1. **Riffi 1, 2 vai 3?** Kuvat `r7-01` (tilapiste), `r7-03` (?-painike) ja
   `r7-06` (vihjerivi). Suosittelen riffiä 1.
2. **Odottavatko pysyvät teot selitystilassa** (`r7-14`, Arkistoi), vai
   pitäisikö niidenkin toimia? Suosittelen odottamista.
3. **Puhelimessa kaksi napautusta** (`r7-19`: ensimmäinen selittää, toinen
   tekee)? Suosittelen.

## Näyttäminen (kierros 7)

```
open-habitat agent view offer --current \
  --source issues/proto-explain-mode-r6/prototype/kierros-7/selitystila-tila.html \
  --title "Selitystila: painallus toimii ja keskustelun tila – kierros 7" \
  --idempotency-key "$(uuidgen)" --json
```

# Kierros 8: tyhjät kohdat ja piilopainikkeet

Jarin päätös 6.11. (kierros 7): Selitä-painike. Prototyyppi on
`prototype/kierros-8/selitystila-kulmat.html` ja opas
`prototype/kierros-8/NOTES.md`. Kuvat ovat `evidence/r8-*.avif` (kerroin
2). Lähde on `design-system/prototypes/rounds/2026-11-06-selitystila-kulmat/`.
?-painike on kaikissa riffeissä.

## Mitä kierroksella 7 tapahtui

- Viestikentän yllä oleva Taustatyö-nauha (kortti V09) on 780 px leveä,
  mutta siinä on vain yksi merkki. Nauha selittyi koko leveydeltään, joten
  sen kortti tuli esiin aina, kun osoitin kulki keskustelusta kenttään
  (`r8-11`). Siitä Jari puhui sanoessaan, että kirjoituskentän palkin
  selitys näkyy liikaa.
- Selitystilan kerros nielee osoittimen, joten rivin piilopainikkeet (Nimeä,
  Arkistoi, työtilan +) eivät koskaan tulleet näkyviin. Silti ne vastasivat
  osoittimeen: rengas kiersi rivin iän, ja kortti puhui Arkistoinnista.

## Kaikissa riffeissä

- Kohta selittyy vain siltä alueelta, jolla siinä on jotain näkyvää (sen
  tekstin, kuvien ja painikkeiden rajaus). Painikkeet, linkit ja kentät
  selittyvät koko alaltaan, koska niissä painallus toimii koko alalla.
- Näkymätön kohta ei selity.

## Riffit: tyhjä kohta ja piilopainikkeet

1. **Kuten aina**: osoitin toimii kuten ilman tilaa. Rivi tuo
   piilopainikkeensa esiin, ja ne selittyvät (`r8-01`, tumma `r8-08`).
   Tyhjän kohdan yllä edellinen kortti jää hiljaisena paikalleen (`r8-04`).
2. **Kaikki esillä**: tila tuo kaikki piilopainikkeet näkyviin kuten
   kosketusnäytöllä (`r8-02`, `r8-09`). Tyhjä kohta on tyhjä (`r8-05`,
   puhelin `r8-14`).
3. **Kokonaisuus kertoo**: rivin kortti luettelee piilopainikkeet (`r8-03`,
   `r8-10`). Tyhjä kohta näyttää alueen nimen (`r8-06`, puhelin `r8-13`), ja
   keskustelussa se kertoo tilanteen; napsautus avaa tilakortin (`r8-07`).

Puhelimella piilopainikkeet näkyvät aina, kuten tuotannossa nytkin
(`r8-12`, `r8-15`).

## Suositus

**Riffi 1, Kuten aina.**

- Se jatkaa kierroksen 7 periaatetta *painallus toimii kuten aina*
  osoittamiseen: henkilö näkee tilassa saman käyttöliittymän, jota hän
  käyttää, ja oppii samalla, että rivillä on piilopainikkeita.
- Jäävä kortti poistaa välkkeen. Kun tyhjä nauha ei enää selity, väliin jää
  enemmän tyhjää, ja riffeissä 2 ja 3 kortti vaihtuisi tyhjäksi tai alueen
  nimeksi joka kerta, kun osoitin ylittää välin.
- Riffi 2 muuttaa sivupalkin asettelua (rivien nimet lyhenevät) ja tuo
  kymmeniä painikkeita esiin kerralla. Riffissä 3 kortit pitenevät, eikä
  piilopainikkeisiin pääse tilassa osoittamalla.

## Host-tiedot

- Uutta host-tietoa ei tarvita. Kaikki kolme riffiä ovat pelkkää selaimen
  logiikkaa tuotannon omien elementtien päällä.
- Toteutusta varten (riffi 1): selitystilan kerros on
  `pointer-events: none`, jolloin tuotannon omat `:hover`-säännöt toimivat
  sellaisinaan. Kohta luetaan `elementsFromPoint`illa, ja painallus
  siepataan capture-vaiheessa. Prototyyppi jäljittelee tätä kopioimalla
  `:hover`-säännöt.
- Näkyvän alueen sääntö: kohteen tekstisolmujen, kuvien ja painikkeiden
  rajaus + 4 px. Painikkeet, linkit, kentät ja alle 6000 px²:n kohdat
  käyttävät koko laatikkoaan. Läpinäkyvä kohta (yhteenlaskettu opacity alle
  0,15 tai `visibility: hidden`) ei selity.
- Piilopainikkeet ovat kaapatuissa näkymissä `.ah-nav-archive` (S12, S13) ja
  `.ah-workspace-more` (S19).
- Kierros ei muuttanut tuotantokoodia. Ajettu Birchlla commitin
  `3ad0e1438` päällä (Node 22.23.2), synteettinen labra
  `OH_PORT_BASE=6474`. Tarkistus: 5942 selitystä 212 näkymäyhdistelmässä ja
  88 tilakorttia. Tavoittamattomia kohtia 0, näkymän ulkopuolelle meneviä
  kortteja 0, virheitä 0, konsoli puhdas.

## Kysymykset Jarille

1. **Riffi 1, 2 vai 3?** Piilopainikkeet: `r8-01`, `r8-02` ja `r8-03`.
   Tyhjä kohta: `r8-04`, `r8-05` ja `r8-06`. Suosittelen riffiä 1.
2. **Selittyykö kohta vain näkyvän sisältönsä alueelta** (`r8-11` oli
   kierroksen 7 tilanne, `r8-05` uusi)? Suosittelen.
3. **Riffissä 3 keskustelun tyhjä kohta kertoo tilanteen** (`r8-07`). Pitäisikö
   se tuoda riffiin 1, niin että tilakortti tulee esiin, kun napsautat
   keskustelun tyhjää kohtaa? Suosittelen: napsautus tyhjään ei tee
   tuotannossa mitään, joten se on vapaa.

## Näyttäminen (kierros 8)

```
open-habitat agent view offer --current \
  --source issues/proto-explain-mode-r6/prototype/kierros-8/selitystila-kulmat.html \
  --title "Selitystila: tyhjät kohdat ja piilopainikkeet – kierros 8" \
  --idempotency-key "$(uuidgen)" --json
```

# Kierros 9: miten tilakorttiin pääsee, kuvina

Jarin päätös 6.11. (kierros 8): riffi 1 *Kuten aina*, ja kohta selittyy vain
näkyvän sisältönsä päällä. Kysymys 3 jäi epäselväksi, joten tämä kierros
näyttää sen kuvasarjoina. Prototyyppi on
`prototype/kierros-9/selitystila-tilakortti.html` ja opas
`prototype/kierros-9/NOTES.md`. Kuvat ovat `evidence/r9-*.avif` (kerroin 2).
Lähde on `design-system/prototypes/rounds/2026-11-06-tilakortin-tie/`.

## Mikä tilakortti on

Tilakortti on kierroksen 7 kortti, joka kertoo keskustelun tilanteen
(esim. *Odottaa sinua*) ja *Voit nyt* -rivit (`r9-04`). Kaikissa suunnissa
Selitä (?) avaa tilan tilakortista (`r9-03` → `r9-04`), ja kortti pysyy,
kunnes osoitat jotain kohtaa. Suunnat eroavat siinä, miten tilakortin saa
takaisin kesken tilan. Jokainen kuvasarja alkaa samasta hetkestä: olet
osoittanut viestiäsi, ja sen kortti näkyy (`r9-05`).

## Suunnat

- **A Selitä-painike**: Selitä (?) yläpalkissa tuo tilakortin takaisin myös
  kesken tilan; tila päättyy Esc:llä tai Lopeta-painikkeella (`r9-06` →
  `r9-07`, tumma `r9-12`, puhelin `r9-17`).
- **B Tyhjä kohta**: napsautus keskustelun tyhjään kohtaan tuo tilakortin;
  Selitä lopettaa tilan (`r9-08` → `r9-09`, tumma `r9-13`, puhelin `r9-18`
  → `r9-21`).
- **C Palkin tilanne**: selitystilan palkki kertoo tilanteen sanoin, ja sen
  painallus tuo tilakortin; Selitä lopettaa tilan (`r9-10` → `r9-11`, tumma
  `r9-14`, puhelin `r9-19` → `r9-20`, muut tilat `r9-15` ja `r9-16`).

Kaikki kuvasarjat rinnakkain: `r9-01` (työpöytä) ja `r9-02` (puhelin).

## Suositus

**C, Palkin tilanne.**

- Se näkyy koko tilan ajan ja on sama työpöydällä ja puhelimella. Sen sana
  on tila itse, joten painamalla saa tilanteen selitettynä. Palkki kertoi
  tilanteen jo kierroksella 8; nyt siitä pääsee eteenpäin.
- A on lähes yhtä hyvä, mutta se muuttaa Selitä-painikkeen merkitystä kesken
  tilan: sama painike avaa tilan mutta ei lopeta sitä. Painikkeen oma kortti
  joutuu kertomaan sen (`r9-06`).
- B:tä ei näe mistään. Puhelimella keskustelu on lähes kokonaan sisältöä:
  tyhjää on vain kapea reunus viestien vieressä (`r9-18`), ja napautus
  tekstiin selittää viestin. Lisäksi B ristiriitaa kierroksen 8 valinnan
  kanssa: kierroksella 8 tyhjä kohta jätti viimeisimmän kortin paikalleen,
  ja B tekisi tyhjästä napsautuksesta teon.

## Host-tiedot

- Uutta host-tietoa ei tarvita. Palkin tilanne on sama tila, jonka
  yläpalkin tilapiste jo näyttää ja jonka mukaan tilakortti valitaan
  (kierros 7).
- C vaatii toteutuksessa, että selitystilan palkki tuntee keskustelun tilan
  ja päivittyy sen muuttuessa. Se on selaimen tilaa, ja tieto on jo
  snapshotissa.
- Kierros ei muuttanut tuotantokoodia. Ajettu Birchlla commitin `6b406fb14`
  päällä (Node 22.23.2), synteettinen labra `OH_PORT_BASE=6574`.
  Tarkistus: 154 kuvaa (kuusi tilaa, kaksi leveyttä, *Odottaa sinua* myös
  tummana), ja jokaisessa näkyy kuvatekstin kertoma asia. Elävässä
  näkymässä kokeiltiin 18 yhdistelmää (suunta × teko × leveys): oma teko
  toi tilakortin, eikä muiden suuntien teko tuonut. Virheitä 0, konsoli
  puhdas.

## Kysymykset Jarille

1. **A, B vai C?** Vertaa kuvia `r9-06` (A2), `r9-08` (B2) ja `r9-10` (C2).
   Lopputulos on kaikissa sama tilakortti (`r9-07`, `r9-09`, `r9-11`).
   Suosittelen C:tä.
2. **Avaako Selitä tilan aina tilakortista** (rivi K: `r9-03` → `r9-04`), vai
   pitäisikö tilan alkaa ilman korttia, kun tilakorttiin pääsee palkista?
   Suosittelen, että tila alkaa tilakortista.
3. **Puhelimella palkissa pelkkä tila** (`r9-19`: *Odottaa sinua ›* ilman
   ohjetekstiä)? Suosittelen.

## Näyttäminen (kierros 9)

```
open-habitat agent view offer --current \
  --source issues/proto-explain-mode-r6/prototype/kierros-9/selitystila-tilakortti.html \
  --title "Selitystila: miten tilakorttiin pääsee – kierros 9" \
  --idempotency-key "$(uuidgen)" --json
```
