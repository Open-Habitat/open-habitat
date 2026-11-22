# Sivupalkki, joka jakaa korkeuden hyödyn mukaan (kierros 3)

Jarin palaute kierrokselle 2: lähde C Suhteessa -suunnasta ja jaa korkeus
hyötyrajoilla. Kummallakin listalla on minimi, jonka alla lista on
kömpelö, ja riittävä raja, jonka jälkeen lisärivit hyödyttävät vähän.
Keskustelulistaa (Sinun vuorosi, Käynnissä ja Hiljaiset otsikoineen ja
reunasiruineen) käytetään paljon enemmän, joten sen rajat ovat Työtiloja
isommat. Tila annetaan järjestyksessä: ensin molemmille minimi, sitten
molemmille riittävä, sitten paikoille isompi koko (kuvakkeet → ruudut →
rivit) ja lopuksi molemmille listoille suhteessa. Jarin mukaan sivupalkki
saa olla leveämpi, ja korkeus on niukka resurssi. Hiljaiset pysyy omana
uusin ensin -listanaan.

Sääntö on `model.ts`:ssä ilman DOMia: sivu, allokaatiokaavio ja
`check.mjs` käyttävät samaa funktiota, ja toteutus voi seurata sitä
rivi riviltä. Tiedoston alussa sääntö on kirjoitettu auki.

Akseli: **kuka joustaa, kun tila ei riitä, ja mitä leveys ostaa**.
Kaikissa suunnissa oletusrajat ovat samat: keskustelut 7 / 14 ja Työtilat
6 / 10 riviä (Jarin esimerkki), riittävän jälkeen 2 : 1.

- **A Tasan**: Jarin järjestys sellaisenaan. Kun molempien minimit eivät
  mahdu, kumpikin jää yhtä suuren osuuden miniminsä alle.
- **B Keskustelut ensin**: samat rajat, mutta pulassa keskustelut saavat
  miniminsä ensin ja Työtilat pitää tuotannon kolmen rivin lattian.
- **C Leveämpi**: A:n säännöt 356 px leveässä sivupalkissa (nyt 296 px).
  Työtilojen suodatin mahtuu otsikkoriville, ruudut yhdelle riville
  (kuvake nimen yllä), ja keskustelurivillä näkyy työtilan nimi kuten
  Jono-kierroksessa.
- **Nyt**: tuotannon sivupalkki vertailuksi.

Issue `rail-space-small-screens`. Luvut, taulukko, suositus ja kysymykset
ovat issuen `result.md`:n kohdassa *Kierros 3*.

Sivu on tuotannon kehys kuten kierroksella 2: `AppShell`, `WorkspaceRail`,
`NowSections`, `QuietSection`, `WorkspaceNavRow`, `WorkspaceActions`,
`SearchDoor`, `AccountShelf` ja avoin keskustelu. Kierroksen omia osia ovat:

- kierroksen 2 mukautuva yläosa `Head` kolmessa askeleessa sekä C:n
  yhden rivin ruudut,
- `measure()`, joka lukee sivupalkista säännön vakiot: kiinteä osa,
  yläosan korkeus kussakin askeleessa (piilotettu `Measure`), kummankin
  listan kiinteä osa (otsikot, suodatin), rivien väli ja rivien määrä,
- sääntö `allocate()` (`model.ts`), jonka tulos asetetaan listojen
  alueiden korkeuksiksi (`--rsp-c-h`, `--rsp-w-h`); jäljelle jäävä tila jää
  tyhjäksi Työtilojen alle,
- Työtilojen reunasirut "↑ 3 työtilaa" ja "↓ 8 työtilaa", jotka peittävät
  reunarivin kuten keskustelujen sirut ja selaavat painettaessa sivun
  kerrallaan; tuotannossa reunassa on vain varjo,
- Hiljaiset ei taitu itsestään A:ssa, B:ssä eikä C:ssä: sääntö antaa
  keskustelulistalle sen tilan, ja lista vierii sirujensa kanssa,
- C:n työtilan nimi riveillä: tuotannon `workspaceTag`. Sinun vuorosi ja
  Käynnissä pitävät kuvakkeensa, koska ilman niitä tuotanto ryhmittelee
  rivit työtilaotsikoiden alle. Hiljaisissa nimi korvaa kuvakkeen, koska
  `QuietSection` näyttää nimen vain ilman kuvakkeita.

Katselmoinnin palkissa on korkeuden esivalinnat 720, 800, 900, 1080 ja
1440 sekä liukusäädin 600–1600 (ikkuna on aina 1280 px leveä), tilanne,
Oman selaimen tila, teema, kieli ja kuvakkeet. Jokaisen suunnan rivillä
ovat sen mitatut rivit 720, 900 ja 1080 px:ssä. Mallipaneelissa ovat:

- sääntörivi: korkeus, askel, seuraavan askeleen korkeus ja kummankin
  listan vyöhyke (alle minimin, minimin ja riittävän välissä, riittävässä),
- kummankin listan mittari: säännön antamat rivit, kokonaan näkyvät rivit,
  rajat ja sisällön määrä,
- allokaatiokaavio: kummankin listan rivit korkeuden funktiona 600–1600 px,
  askeleet taustan vyöhykkeinä, rajat katkoviivoina ja nykyinen korkeus
  pystyviivana,
- hyötykäyrät: kummankin listan seuraavan rivin arvo pikseliä kohden,
  paikkojen arvo vaakaviivana ja nykyisen korkeuden kohta palloina,
- *Rajat*-laatikko: minimit, riittävät, suhde, paikkojen arvo, kuka
  joustaa ja käyrän muoto (kulmat tai pehmeä). Muutos koskee valittua
  suuntaa, ja *Palauta oletukset* palauttaa sen.

Osoitevalinnat: `?h=900`, `?world=like|crowded`, `?browser=agent|ask`,
`?theme=dark|contrast`, `?lang=en` ja `?d=0..3`. `?bare=1` piilottaa
palkin ja täyttää ikkunan. Tarkistus mittaa tällä tavalla.

Puhelin on rajattu pois kuten kierroksilla 1 ja 2. Kuvakkeet ovat
kierroksen 2; kuvakkeille on oma rinnakkainen kierroksensa.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-22-rail-space-3/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 1800 \
  node design-system/prototypes/rounds/2026-11-22-rail-space-3/check.mjs \
  design-system/prototypes/dist/rail-space-3/offline.html <kuvahakemisto> [--quick]
```

Linuxissa komennot ajetaan scratch-leasen alla yksityisellä `TMPDIR`:llä ja
`umask 077`:llä. Rakennus kirjoittaa hakemistoon
`design-system/prototypes/dist/rail-space-3/` tiedostot `offline.html`
(fontit upotettuina) ja `index.html` (ilman fontteja). `check.mjs`:n alussa
kerrotaan, mitä se tarkistaa. Se kirjoittaa `rows.json`-taulukon, josta
`text.ts`:n `ROWS` ja `result.md`:n luvut tulevat, ja epäonnistuu, jos
sivulla näkyvä luku ja mittaus eroavat.
