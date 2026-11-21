# Väreilyn muodot – kierros 7

Jari valitsi kierroksen 6 suunnan B Väreilyn muoto: ei kuvaa, renkaiden
muoto kertoo esineen. Tässä kierroksessa jokainen kymmenestä merkistä on
kolmena muunnelmana, ja jokaisella kolmikolla on oma ajatuksensa (rivin
otsikossa, `emblems.tsx`:n `TRIO`). Kalimba ja Kulho saavat rohkeimmat
muunnelmat. Muunnelma 0 on kierroksen 6 B sellaisenaan.

Issue `attention-sound`. Muunnelmat, suositukset ja kysymykset ovat issuen
`result-emblems-7.md`:ssä.

Valitsimessa on kaksi näkymää:

- **Vertailurivit**: kymmenen ääntä riveinä, kullakin nykyinen merkki ja
  kolme muunnelmaa. Jokainen merkki näkyy laatan (76 px) ja työtilarivin
  (32 px) koossa, ja painallus soittaa äänen ja levittää väreilyn lyönti
  kerrallaan valitulla pituudella. Kunkin muunnelman alla on “Asetuksiin”
  (natiivi radioryhmä riviä kohden). Suositus on merkitty ja valmiiksi
  valittuna; “Kaikki nykyiset” ja “Kaikki suositukset” vaihtavat koko sarjan.
- **Asetuksissa**: kierroksen 6 Asetukset › Äänet (tuotannon `AppShell`,
  `AccountSettings`, `s-card`/`s-row`, `Segmented`, `ChoiceMenu` …) valituilla
  muunnelmilla laatoissa ja työtilariveillä.

Valinnat säilyvät näkymää vaihdettaessa. `?valinta=` ja kymmenen numeroa
0–3 (äänten järjestyksessä Kalimba … Jääpuikot) asettaa sarjan, esimerkiksi
`?valinta=0000000000` kaikki nykyiset. Muut parametrit kuten kierroksessa 6:
`?s=oletus|pitkat|yo|pois|mykistetty`, `?theme=dark|contrast`,
`?motion=reduced`, `?lang=en`.

Äänet ovat kierroksen 5 kymmenen lopullista ääntä ennallaan: `round.tsx` ja
`check.mjs` tuovat ne tiedostosta `../2026-11-21-attention-sounds-4/synth.mjs`.
Jos kierros 5 poistuu ennen tätä, kopioi `synth.mjs` tähän hakemistoon.
Lyhyet on oletus. Jokainen soitto kirjautuu `window.__rqPlays`-taulukkoon.

## Rakentaminen ja tarkistus

```
npm ci --prefix web     # kerran, lukitiedoston mukaan
node design-system/prototypes/rounds/2026-11-21-attention-sound-emblems-7/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 1800 \
  node design-system/prototypes/rounds/2026-11-21-attention-sound-emblems-7/check.mjs \
  design-system/prototypes/dist/attention-sound-emblems-7/offline.html <kuvahakemisto> [--quick]
```

Rakennus kirjoittaa `design-system/prototypes/dist/attention-sound-emblems-7/`:ään
`offline.html`:n (fontit upotettuina) ja `index.html`:n (ilman fontteja).
`check.mjs`:n alku kertoo, mitä se tarkistaa. Merkkien erottuvuus mitataan
rasteroimalla: kunkin rivin neljän merkin ja kaikkien neljänkymmenen
merkin välillä erottuvan musteen osuus on yli 0,25 (rivi) ja 0,2 (kaikki),
ja Asetuksissa-näkymän kymmenen merkkiä erottuvat sekä suosituksilla että
kaikilla nykyisillä. `--quick` ajaa vain 1440 px:n Päivä-teeman.
