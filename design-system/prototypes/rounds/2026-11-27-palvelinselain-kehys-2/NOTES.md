# Palvelinselaimen kehys, kierros 2 · 27.11.2026

Issue `server-browser-frame`. Kierroksen 1 suunta 1 Paneeli Jarin
karsimana: etänäyttö pysyy kiinteänä 1280 × 800, Chromen oma
välilehtirivi ei näy kuvassa, `<` / `>` on poistettu, ⋯-valikossa on
Leikkaa, Kopioi ja Liitä pikanäppäimineen, *Sulje välilehti*, ja Valmis on
ennallaan.

Valitsimessa on kaksi kohtaa: **1 Paneeli** ja **Nykyinen** (tuotannon arkki
saman sivun ympärillä; kuvassa piirretty Chromen välilehti- ja osoiterivi).
Kierroksen 1 *Vertaa nykyiseen* -valinta on siis valitsimen toinen kohta, ja
valitsimen sopimus (vähintään kaksi kohtaa) pysyy.

- Paneelin kuvassa sivu saa koko 800 px korkeuden: host käynnistäisi
  Chromen `--kiosk`-tilassa ja tekisi ponnahdusikkunasta koko näytön
  kokoisen CDP:llä. Aktiivinen välilehti näyttää originsa palkissa, koska
  Chromen osoiteriviä ei enää ole.
- Klikkaus kuvaan ottaa ohjauksen ja levittää paneelin; tuotannon
  *Keskustelu*-reuna kaventaa sen.
- Leikkaa/Kopioi/Liitä toimivat kuten näppäimet kuvassa: kun agentti odottaa,
  ne ottavat ensin ohjauksen; kun agentti on kesken, ne kysyvät.
- Puhelimessa palkin näppäimistöpainike kohdistaa näkymättömän kentän, joka
  avaa järjestelmän näppäimistön; merkit menevät sivulle näppäilyinä.

Katselmointipalkissa: tilat, *Monta välilehteä* ja *⌘V: pitkä teksti*.
Kuvan koko ja sivulle jäävä korkeus näkyvät palkissa.

## Rajaus

Tuotannon komponentteja: sovelluskehys, sivupalkki ja Oma selain -rivi,
keskustelu, Selain-kortti, `ViewSplit`, painikkeet ja valikot, kehyksen
reuna, kesken-kysymys ja kuittauksen tyyli sekä Nykyinen-kohdan arkki.
Kierroksen omia: ohut palkki, välilehtirivi, puhelimen näppäimistökenttä,
piirretyt kolmannen osapuolen sivut ja Chromen rivi (kiinteät värit) sekä
kokomittari. Prototyyppi ei lue eikä kirjoita oikeaa leikepöytää. Vain
suomeksi. Kokonaan synteettinen.

## Rakentaminen ja tarkistus

Repojuuresta, kun `web/node_modules` on asennettu lukkotiedostosta.
Linuxissa scratch-hakemistossa, omalla TMPDIR:llä.

```sh
round=design-system/prototypes/rounds/2026-11-27-palvelinselain-kehys-2
node "$round/build.mjs"   # dist/2026-11-27-palvelinselain-kehys-2/offline.html
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 900 \
  node "$round/check.mjs" design-system/prototypes/dist/2026-11-27-palvelinselain-kehys-2/offline.html <out> [--quick]
```

Osoitevalinnat: `?v=1|2&theme=light|dark&state=agent|ask|person|popup|back|stopped&many=1&measure=1`.
`check.mjs`:n alku kertoo, mitä se käy läpi (Päivä/Yö × 1440 × 900,
1440 × 780 ja 390 × 844, palkin ohjainten vierekkäisyys, koot
`sizes.json`iin).
