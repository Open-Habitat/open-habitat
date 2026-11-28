# Palvelinselaimen kehys, kierros 4 · 28.11.2026

Issue `server-browser-frame`. Jarin päätös kierroksen 3 jälkeen: kuvassa on
koko Chrome-ikkuna omine välilehtineen, osoiteriveineen, takaisin- ja
päivityspainikkeineen, historioineen ja kirjanmerkkeineen. Habitatin
palkissa ei ole mitään välilehdistä. Kioskitilaa ei käytetä. Pohjana on
kierroksen 2 koodi (Paneeli ja Nykyinen).

Valitsimessa on kaksi kohtaa: **1 Koko ikkuna** ja **Nykyinen** (tuotannon
arkki saman Chrome-ikkunan ympärillä).

- Chrome-ikkuna on piirretty niin kuin se mitattiin google-chromella
  Xvfb:ssä ilman ikkunanhallintaa, eli samoin kuin host sen ajaa.
  Ikkunapainikkeita ei ole. Välilehtirivi on 40 px, työkalurivi 47 px ja
  kirjanmerkkipalkki 34 px lisää, kun Chrome näyttää sen. Ponnahdusikkuna
  peittää koko näytön, ja siinä on vain 34 px:n vain luku -osoiterivi eikä
  sulkemispainiketta.
- Jokainen klikkaus piirrettyyn ikkunaan on klikkaus etänäytölle. Se ottaa
  ohjauksen kuten mikä tahansa klikkaus, ja kun agentti on kesken, se
  kysyy ensin. Välilehdet, ×, +, ←, ↻, osoiterivi, ☆ ja kirjanmerkit
  toimivat kuvassa. ⌘L/Ctrl+L, ⌘R ja Alt+← menevät etä-Chromelle.
- Habitatin palkissa on *Oma selain*, vuoro, puhelimen näppäimistöpainike,
  ⋯ ja Valmis tai ×. ⋯-valikossa ovat vuoron vaihto, Leikkaa, Kopioi ja
  Liitä, ponnahdusikkunan ollessa edessä *Sulje ponnahdusikkuna*, Sulje
  selain, lause siitä, mitä agentti saa käyttää, ja työpöydällä lause
  ⌘T/⌘W/⌘N-näppäimistä.

Katselmointipalkissa: tilat, *Monta välilehteä*, *Kirjanmerkkipalkki* ja
*⌘V: pitkä teksti*. Kuvan koko ja sivulle jäävä korkeus näkyvät palkissa.

## Rajaus

Tuotannon komponentteja: sovelluskehys, sivupalkki ja Oma selain -rivi,
keskustelu, Selain-kortti, `ViewSplit`, painikkeet ja valikot, kehyksen
reuna, kesken-kysymys, kuittauksen tyyli ja Nykyinen-kohdan arkki.
Kierroksen omia: ohut palkki, piirretty Chrome-ikkuna ja sivut (kiinteät
värit), puhelimen näppäimistökenttä ja kokomittari. Prototyyppi ei lue eikä
kirjoita oikeaa leikepöytää. Vain suomeksi. Kokonaan synteettinen.

## Rakentaminen ja tarkistus

Repojuuresta, kun `web/node_modules` on asennettu lukkotiedostosta.
Linuxissa scratch-hakemistossa, omalla TMPDIR:llä.

```sh
round=design-system/prototypes/rounds/2026-11-28-palvelinselain-kehys-4
node "$round/build.mjs"   # dist/2026-11-28-palvelinselain-kehys-4/offline.html
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright timeout 1500 \
  node "$round/check.mjs" design-system/prototypes/dist/2026-11-28-palvelinselain-kehys-4/offline.html <out> [--quick]
```

Osoitevalinnat: `?v=1|2&theme=light|dark&state=agent|ask|person|popup|back|stopped&many=1&bookmarks=1&measure=1`.
Ilman `?theme=`-valintaa teema tulee `initialTheme()`-funktiosta.
`check.mjs`:n alussa kerrotaan, mitä se käy läpi, ja koot kirjoitetaan
`sizes.json`iin.
