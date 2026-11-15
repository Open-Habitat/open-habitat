# Palaa tähän – kaikki muutokset

Issue `rewind-tracks-all-changes` (suunnitelma sen `design.md`:ssä). Kun
työtilasta otetaan tilannekuva jokaisen vuoron alussa ja lopussa, *Palaa
tähän* voi palauttaa myös komentojen muuttamat tiedostot. Tilannekuvien ero
kertoo, mitkä tiedostot muuttuivat agentin vuoron aikana ja mitkä vain
vuorojen välissä, mutta ei sitä, kuka vuoron aikana muutti. Kierros kysyy
yhden asian: kuinka paljon *Tiedostot*-valinta palauttaa ja kuka sen päättää.

Arkki on tuotannon *C Pieni arkki* (`web/src/components/Rewind.tsx`) samoilla
luokilla. Kierroksen omia ovat listan merkinnät *komento* ja *vuorojen
välissä*, rivit jäävistä ja palautumattomista asioista sekä C:n kolmas
valinta. Kaikki on synteettistä; mitään ei lähetetä eikä palauteta.

## Suunnat

Akseli: kuinka paljon palautuu ja kuka sen valitsee. Sisältö on kaikissa
sama: kolme muokkaustyökalun tiedostoa, kolme komennon muuttamaa (formatoija,
skripti, `rm`) ja kaksi, joita vain henkilö muutti vuorojen välissä.

- **A Kaikki takaisin**: työtila palaa kokonaan viestiä edeltävään tilaan,
  8 tiedostoa. Varoitus puhuu koko työtilasta.
- **B Agentin vuorot**: palautuu 6 tiedostoa, jotka muuttuivat agentin
  vuorojen aikana. Kaksi vuorojen välissä muuttunutta jää; rivi sanoo sen ja
  lista näyttää ne merkinnällä *jää*. Suunnitelman suositus.
- **C Valitse itse**: kuten B, ja kolmas valinta *Myös vuorojen välissä
  muuttuneet* nostaa määrän kahdeksaan.

Kaikissa sama rivi siitä, mikä ei palaudu: agentin commit, ohitetut
tiedostot ja työtilan ulkopuoli.

Yläpalkin *Tilanne*:

- *Tilannekuva on*: tavallinen tapaus.
- *Agentti vaihtoi haaraa*: Tiedostot alkaa valitsematta ja arkki sanoo
  syyn; valinnan voi silti tehdä.
- *Ei tilannekuvaa (vanha viesti)*: nykyinen toiminta, vain
  muokkaustyökalujen kolme tiedostoa, ja arkki sanoo, että komentojen
  muutokset jäävät.

## Havainto

Puhelimessa kolme selitysriviä ja tiedostolista eivät mahdu kentän
yläpuolelle; kierroksessa arkki vierii sisältään. C:n kolmas valinta vie
puhelimessa eniten tilaa: painikkeet jäävät vierityksen taakse, kun lista on
auki. Toteutuksessa tekstit kannattaa tiivistää tai lista avata erilleen.

## Rakentaminen ja tarkistus

```
ln -s ~/src/open-habitat/web/node_modules web/node_modules   # tai: cd web && npm ci
node design-system/prototypes/rounds/2026-11-15-rewind-all-changes/build.mjs
node design-system/prototypes/rounds/2026-11-15-rewind-all-changes/check.mjs \
  design-system/prototypes/dist/rewind-all-changes/offline.html <kuvahakemisto>
```

`check.mjs` käy suunnat läpi vaaleana ja tummana, 1440 ja 390 px: arkki
avattuna, tiedostolista, C:n kolmas valinta, tulosrivi ja kaksi muuta
tilannetta (340 tarkistuspistettä, konsoli puhdas, arkki kokonaan kentän
yläpuolella).
