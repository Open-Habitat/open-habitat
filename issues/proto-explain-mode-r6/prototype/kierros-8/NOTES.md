# Selitystila, kierros 8: tyhjät kohdat ja piilopainikkeet

Avaa `selitystila-kulmat.html`. Se on yksi offline-sivu eikä käytä verkkoa.
Näkymät ovat tuotannon oikeita näkymiä synteettisestä labrasta. Kortit ovat
kierroksen 6 tyyliä 1, ja kierroksen 7 valinta, ?-painike yläpalkissa, on
mukana kaikissa riffeissä.

Sivu aukeaa selitystila päällä, ja osoitin on valmiiksi sivupalkin
ensimmäisellä keskustelurivillä. Riffien ero näkyy jo siinä: valitsimesta
(näppäimet 1–3) vaihdat riffiä.

**Kaikissa riffeissä:**

- **Kohta selittyy vain siltä alueelta, jolla siinä on jotain näkyvää.**
  Kierroksella 7 viestikentän yllä oleva Taustatyö-nauha selittyi koko
  leveydeltään, vaikka siinä oli vain yksi pieni merkki. Siksi kortti tuli
  esiin aina, kun osoitin kulki keskustelusta kenttään (kuva `r8-11`). Nyt
  nauha selittyy vain merkkinsä kohdalta. Painike, linkki ja kenttä
  selittyvät yhä koko alaltaan, koska painallus toimii siinä koko alalla.
- **Näkymätön painike ei selity.** Kierroksella 7 rivin piilossa oleva
  Arkistoi vastasi osoittimeen, vaikka sitä ei näkynyt: rengas kiersi rivin
  iän (”nyt”), ja kortti puhui Arkistoinnista.
- ?-painike avaa tilan tilakortista, ja tilakortti pysyy, kunnes osoitat
  jotain kohtaa.

**Riffit**

1. **Kuten aina** (suositus). Osoitin toimii selitystilassa samoin kuin ilman
   sitä. Kun osoitat riviä, sen Nimeä- ja Arkistoi-painikkeet tulevat esiin
   kuten aina, ja kun osoitat niitä, ne selittyvät (`r8-01`). Tyhjän kohdan
   yllä edellinen kortti jää paikalleen ja hiljenee, kunnes osoitat uutta
   kohtaa (`r8-04`). Kortti ei siis välky, kun osoitin kulkee kohdasta
   toiseen.
2. **Kaikki esillä.** Selitystila tuo kaikki piilopainikkeet näkyviin
   kerralla, kuten kosketusnäytöllä: jokaisella rivillä on Nimeä ja Arkistoi,
   ja jokaisella työtilalla on + (`r8-02`). Ohut katkoviiva kertoo, että ne
   ovat tavallisesti piilossa. Tyhjän kohdan yllä kortti ja himmennys
   väistyvät, eikä tilalle tule mitään (`r8-05`).
3. **Kokonaisuus kertoo.** Piilopainikkeet pysyvät piilossa, ja rivin kortti
   kertoo ne: *Rivillä myös, kun osoitin on sen päällä: Nimeä uudelleen…
   Arkistoi…* (`r8-03`). Tyhjän kohdan yllä näkyy alueen nimi yhdellä
   rivillä, esimerkiksi *Viestikenttä · mitä kirjoitat agentille*
   (`r8-06`). Keskustelun tyhjässä kohdassa rivi kertoo tilanteen, ja
   napsautus avaa tilakortin (`r8-07`).

**Puhelimella** piilopainikkeet näkyvät aina, kuten tuotannossa nytkin
(`r8-12`), joten niihin ei tarvita mitään uutta. Napautus tyhjään toimii
riffin mukaan: riffissä 1 kortti jää, riffissä 2 se sulkeutuu ja riffissä 3
näkyy alueen nimi (`r8-13`). Riffin 3 alueen nimi on puhelimella alueen
reunassa, koska osoitinta ei ole.

## Kokeile näin

1. Sivu aukeaa kohdassa *Osoitin: Ensimmäinen rivi*. Vaihda riffejä 1–3 ja
   katso riviä: riffissä 1 rivin painikkeet heräävät, riffissä 2 kaikkien
   rivien painikkeet ovat esillä, ja riffissä 3 kortti luettelee ne.
2. Valitse *Rivin oikea reuna*: riffeissä 1 ja 2 Arkistoi selittyy ja kertoo
   odottavansa selitystilassa. Riffissä 3 selittyy rivi.
3. Valitse *Tyhjä kentän yllä*: osoitin tulee Taustatyön merkistä nauhan
   tyhjään kohtaan. Riffissä 1 merkin kortti jää, riffissä 2 näkymä on tyhjä
   ja riffissä 3 näkyy *Viestikenttä*.
4. Valitse *Tyhjä keskustelussa* ja napsauta riffissä 3: tilakortti aukeaa.
5. Liikuta oikeaa osoitinta vapaasti, esimerkiksi keskustelusta kenttään ja
   sivupalkin riviltä toiselle. Vertaa, miltä kukin riffi tuntuu
   liikkeessä. Tämän näkee vain kokeilemalla.
6. Vaihda *Puhelin 390* ja näkymä *Sivupalkki*, ja napauta riviä, sen
   painiketta ja tyhjää kohtaa.

## Rajat

- Riffi 1 jäljittelee tuotannon omia `:hover`-sääntöjä: jokainen sääntö
  vastaa myös osoittimen alla olevaa ketjua. Toteutuksessa sama tapahtuu
  itsestään, jos selitystilan kerros päästää osoittimen läpi
  (`pointer-events: none`) ja lukee kohdan `elementsFromPoint`illa.
- Piilopainikkeita on kaapatuissa näkymissä kahdenlaisia: keskustelurivin
  Nimeä ja Arkistoi sekä työtilarivin +. Lista on tuotannon CSS:stä
  (`.ah-nav-archive`, `.ah-workspace-more`).
- Kohdan ”näkyvä alue” on sen tekstin, kuvien ja painikkeiden yhteinen
  rajaus, jota on laajennettu 4 px:llä. Pienet kohdat (alle 6000 px²) ja
  painikkeet käyttävät koko laatikkoaan.

Kuvat ovat issuen `evidence/`-hakemistossa etuliitteellä `r8-`. Suositus ja
kysymykset ovat issuen `result.md`:ssä.

## Rakentaminen ja tarkistus

Lähde on `design-system/prototypes/rounds/2026-11-06-selitystila-kulmat/`.
Kortit ovat kierroksen 6 `cards.mjs`:ssä. Tilat, alueiden nimet ja riffien
rivit ovat `state.mjs`:ssä.

```
OH_PORT_BASE=6474 scripts/lab.sh start && PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-selitystila-kulmat/capture.mjs
node design-system/prototypes/rounds/2026-11-06-selitystila-kulmat/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-selitystila-kulmat/shoot.mjs issues/proto-explain-mode-r6/evidence
python3 scripts/screenshots-to-avif.py issues/proto-explain-mode-r6/evidence
```

Tarkistus käy läpi jokaisen riffin, näkymän ja leveyden (riffi 1 myös
tummana). Se osoittaa tai napauttaa jokaista kohtaa ja varmistaa, että
kortti pysyy näkymässä. Kierroksen 7 painallukset tarkistetaan kaikissa
riffeissä. Kulmatapauksista tarkistetaan vaaleana ja tummana, että tyhjä
nauha ei selity, että näkymätön Arkistoi ei selity ja että kunkin riffin
tyhjä kohta ja piilopainikkeet toimivat kuvatusti, myös puhelimella.
Tulos: 5942 selitystä 212 näkymäyhdistelmässä ja 88 tilakorttia. Avoimen
listan peittämiä kohtia oli 1485, tavoittamattomia 0 ja näkymän
ulkopuolelle meneviä kortteja 0. Virheitä ei ollut, ja konsoli pysyi
puhtaana.
