# Hiljaisuuden syy yhdellä rivillä: Asetukset › Äänet (kierros 2)

Issue `attention-sound-night-visible`. Kierros 1:stä Jari valitsi C:n:
tilarivi Äänet-sivun ylimpänä, yö kellonaikana (oletus 22–7), ei yhden yön
ohitusta; rivin toiminto muuttaa asetusta pysyvästi. Avoin kysymys: pitäisikö
sama rivi kertoa myös "Tämä laite on mykistetty" ja "Äänet ovat pois
kaikilta laitteilta", jotka tuotannossa ovat huomautuksia laitekortin
lopussa.

Akseli: **mitkä hiljaisuudet ylärivi kertoo ja montako kerralla**. Yö,
kello ja muu sivu ovat kaikissa suunnissa kierros 1:n C.

- **A Vahvin syy**: yksi rivi, aina vahvin voimassa oleva syy ja sen yksi
  korjaus. Järjestys: pois kaikilta (koskee kaikkia laitteita ja kestää)
  › tämä laite mykistetty (tämän laitteen pysyvä valinta) › yö (loppuu
  aamulla itsestään). Korjattu syy paljastaa seuraavan. Tuotannon
  alahuomautukset poistuvat.
- **B Kaikki syyt**: rivi "Äänet ovat hiljaa tällä laitteella", syiden
  määrä ja jokainen syy omana rivinään omalla korjauksellaan. Kun äänet
  ovat pois kaikilta, muiden syiden alla lukee "ei vaikuta, ennen kuin
  äänet ovat päällä". Alahuomautukset poistuvat.
- **C Vain yö**: rivi kertoo vain kellon tuoman yön ja vain, kun äänet
  ovat päällä. Pois kaikilta näkyy Äänet-kytkimestä heti rivin alla, ja
  mykistys pysyy laitekortin kontrollina ja tuotannon huomautuksena.

Korjaukset ovat oikeita asetuksia: *Laita äänet päälle* (Äänet: Päällä),
*Poista mykistys* (Tämän laitteen äänet: Soi), *Ota yöhiljaisuus pois*
(Hiljennä yöllä: Pois). Yörivillä on lisäksi *Muuta aikaa*, joka vie
kelloriville. Ilmoitus kertoo, mikä asetus muuttui ja mistä sen saa
takaisin. Tilivalikon Äänet-rivi lukee tilan tuotannon järjestyksessä
(pois › mykistetty › yö) kaikissa suunnissa.

Tilanteet: *Klo 23.40, tämä laite mykistetty* (oletus), *Klo 23.40, kaikki
muu päällä*, *Klo 14.10, tämä laite mykistetty*, *Klo 14.10, äänet pois
kaikilta*, *Klo 23.40, pois kaikilta ja mykistetty*, *Klo 14.10, kaikki
soi*. Tilanne asettaa alkuarvot; sivun kontrollit muuttavat niitä elävästi.

Osoitevalinnat: `?v=1..3`, `?theme=dark`, `?lang=en`,
`?scenario=nightMuted|night|muted|off|all|normal`,
`?device=both|desktop|phone`. Puhelinkehys on sama sivu valinnoilla
`?bare=1&d=0..2`.

Sivu on tuotannon asetuskehys ja kontrollit kuten kierros 1:ssä; sivun
runko on kopio `SoundSettings.tsx`:stä paikallisella tilalla, ilman verkkoa.
Sisältö on synteettistä.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-22-night-quiet-2/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 900 \
  node design-system/prototypes/rounds/2026-11-22-night-quiet-2/check.mjs \
  design-system/prototypes/dist/night-quiet-2/offline.html <kuvahakemisto>
```

Linuxissa komennot ajetaan scratch-leasen alla yksityisellä `TMPDIR`:llä
ja `umask 077`:llä. Rakennus kirjoittaa `offline.html`:n (fontit upotettuina)
ja `index.html`:n (ilman fontteja) hakemistoon
`design-system/prototypes/dist/night-quiet-2/`. `check.mjs`:n alussa
kerrotaan, mitä se tarkistaa.
