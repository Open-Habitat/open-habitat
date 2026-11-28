# Palvelinselaimen kehys, kierros 3 · 28.11.2026

Issue `server-browser-frame`. Kierroksen 2 Paneeli hyväksyttynä (Valmis,
välilehdet Habitatin palkissa, ⋯ ja Leikkaa/Kopioi/Liitä, Sulje välilehti,
Chrome kioskitilassa). Tämä kierros lisää osoitteen kirjoittamisen,
historian, minimaaliset kirjanmerkit sekä ⋯-valikkoon *Takaisin* ja *Lataa
uudelleen*.

Valitsimessa kaksi suuntaa, jotka eroavat siinä, missä osoite ja historia
asuvat:

1. **Osoite palkissa:** palkin origin (tai ⋯ › *Avaa osoite…*, Ctrl/⌘L)
   muuttuu osoitekentäksi, ja ehdotukset avautuvat sen alle. Historia on
   paneeli kuvan oikeassa reunassa.
2. **Komentoarkki:** samat käynnistimet avaavat yhden arkin kuvan päälle.
   Siinä ovat osoite, ehdotukset, kirjanmerkit ja historia päivittäin.
   ⋯ › *Historia* avaa saman arkin tyhjällä kentällä.

Yhteistä: kentän avaaminen ei ota ohjausta, mutta sivun avaaminen ottaa
(ja kysyy, jos agentti on kesken), kuten välilehden valinta. ↵ avaa
nykyisessä välilehdessä, Alt/⌥+↵ ja palkin + avaavat uudessa. Tekstistä,
joka ei ole osoite, tulee haku palvelinselaimen oletushakukoneella
(nimettynä). Vain http- ja https-osoitteet avautuvat. *Tyhjennä historia…*
avaa Chromen oman *Poista selaustiedot* -sivun uuteen välilehteen.

Katselmointipalkissa: tilat, *Monta välilehteä* ja *Kirjanmerkit*
(minimiversio päälle tai pois).

## Rajaus

Tuotannon komponentteja: sovelluskehys, sivupalkki ja Oma selain -rivi,
keskustelu, Selain-kortti, `ViewSplit`, painikkeet ja valikot, kehyksen
reuna, kesken-kysymys ja kuittauksen tyyli. Kierroksen omia: palkki,
välilehdet, osoitekenttä, ehdotuslista, historiapaneeli, arkki ja piirretyt
sivut (kiinteät värit). Historia ja kirjanmerkit ovat keksittyjä. Vain
suomeksi. Kokonaan synteettinen.

## Rakentaminen ja tarkistus

Repojuuresta, kun `web/node_modules` on asennettu lukkotiedostosta.
Linuxissa scratch-hakemistossa, omalla TMPDIR:llä.

```sh
round=design-system/prototypes/rounds/2026-11-28-palvelinselain-kehys-3
node "$round/build.mjs"   # dist/2026-11-28-palvelinselain-kehys-3/offline.html
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 1500 \
  node "$round/check.mjs" design-system/prototypes/dist/2026-11-28-palvelinselain-kehys-3/offline.html <out> [--quick]
```

Osoitevalinnat: `?v=1|2&theme=light|dark&state=agent|ask|person|back&many=1&bookmarks=0`.
Ilman `?theme=`-valintaa teema tulee `initialTheme()`-funktiosta
(`#ah-theme=`, sitten `prefers-color-scheme`). `check.mjs`:n alussa kerrotaan,
mitä se käy läpi.
