# Navigaatio, kierros 2 — 22.11.2026

Toinen vapaa kierros koko sovelluskehyksestä (issue `ui-structure-free-round`).
Kierroksen 1 kolme suuntaa hylättiin. Tämä kierros lähtee siitä, mitä
Habitatissa tehdään ja kuinka usein. Analyysi on issuen `result.md`:ssä
(Kierros 2). Akseli: **millä navigaatio vastaa kysymykseen "kenen vuoro, ja
minne seuraavaksi"**. Vaihtoehdot ovat pysyvä lista, kutsuttava pinta tai
esikatselu.

Näkymä on sama kaikissa: sovelluskehys, auki keskustelu "Toimituskulut
verkkokauppaan" (agentti ajaa testejä), 10 työtilaa ja 22 keskustelua, joista 3
on Sinun vuorosi ja 3 Käynnissä (yksi niistä on apulainen). Kaikki nimet ovat
keksittyjä. Keskustelun yläpalkki ja kenttä ovat samat kaikissa suunnissa, koska
ne eivät ole tämän kierroksen akseli. Editori, Pääte ja `⋯` ovat kuvakkeina
design.md:n säännön mukaan. Kentän yllä ei ole selainsirua, koska
selainkierroksen 2 päätöksen mukaan selain on vain sivupalkissa.

Sivun ylärivi kertoo suunnan idean ja sen, montako riviä 1280×720:een mahtuu.
`check.mjs` mittaa luvut paljaasta sovelluksesta (`?bare=1`) ja kaatuu, jos
rivin luku on eri.

## Suunnat

1. **Jono.** Yksi pysyvä 280 px:n sivupalkki käyttötiheyden järjestyksessä.
   Ylärivillä ovat palvelin (Etusivu), haku ja uusi keskustelu. Sitten tulevat
   Sinun vuorosi ja Käynnissä, joiden jokaisella rivillä on työtilan nimi.
   Niiden alla on työtilalista nimineen ja tilamerkkeineen. Hiljaiset eivät ole
   erillinen lista, vaan ne avautuvat työtilan alle paikallaan, ja avatun
   työtilan viimeinen rivi on Työtilan sivu. Tuotokset, Oma selain, Agentin
   käytössä, Selitä ja tili ovat yhdellä 48 px:n rivillä alareunassa.
   1280×720: **6 keskustelua + 10 työtilaa**, eli kaikki odottava ja kaikki
   työtilat nimineen. Pysyvää yläpalkkia ei ole.
2. **Kutsuttava.** Pysyvää navigaatiota ei ole. Yläpalkin vasemmassa reunassa
   on merkki ja laskurit `● 3 ◌ 3`, jotka kertovat kenen vuoro on ja avaavat
   navigaattorin vasemmalta. Navigaattori on myös haku: ⌘K avaa sen kenttä
   kohdistettuna, ja kirjoittaminen suodattaa. Sisältö on sama kuin suunnan 1
   sivupalkissa. **Seuraava**-painike vie suoraan seuraavaan Sinun vuorosi
   -keskusteluun, kuten tuotannon NextWaitingDock mutta aina näkyvissä. Neulalla
   navigaattorin voi kiinnittää sivupalkiksi, ja kiinnitys on laitekohtainen.
   1280×720: **0 keskustelua + 0 työtilaa** näkyvissä, kutsuttuna **6 + 10**.
3. **Katsaukset vierellä.** Sivupalkki on kapea Etusivu (340 px, 1920:ssa
   420 px). Jokainen Sinun vuorosi- ja Käynnissä-keskustelu on kortti, jossa on
   otsikko, työtila ja mitä agentti haluaa ("Kysyy: …", "Pyytää selainta: …",
   "Ajaa testejä"). Hiljaiset ovat yksirivisinä korttien alla. Työtila on
   rajausvalikko, joka rajaa koko listan. 1280×720: **7 keskustelua + 0
   työtilaa**. Työtilan nimi näkyy jokaisella rivillä ja valikossa.

## Kartta: nykyinen osa → missä se nyt asuu

| Nykyinen | 1 Jono | 2 Kutsuttava | 3 Katsaukset vierellä |
|---|---|---|---|
| Palvelimen nimi ja yhteys → Etusivu | sivupalkin ylärivi | navigaattorin merkki (vihjeessä nimi); yläpalkissa merkki | sivupalkin ylärivi |
| Haku (⌘K) | ylärivin kuvake → paletti | navigaattorin kenttä: haku ja navigaatio ovat sama pinta | ylärivin kuvake → paletti |
| Uusi keskustelu | ylärivin kynä | paletti/navigaattori | ylärivin kynä |
| Sinun vuorosi, Käynnissä | sivupalkin ylin osa, työtila joka rivillä | yläpalkin `● 3 ◌ 3` ja Seuraava; listat navigaattorissa | kortit: otsikko, työtila, mitä agentti haluaa |
| Hiljaiset | työtilan alla, avautuu paikallaan | sama navigaattorissa | yksirivisinä korttien alla |
| Hiljaisten rajaus ja järjestys | työtilan avaaminen on rajaus | sama + haku | työtilavalikko rajaa koko listan |
| Työtilat, Uusi työtila | nimilista tilamerkein, otsikon `+` | sama navigaattorissa | rajausvalikko tilamerkein, valikon `+` |
| Työtilan sivu | avatun työtilan viimeinen rivi | sama | rajauksen otsikko |
| Apulaiset | oma sisennetty rivi Käynnissä | sama | oma kortti, edistys tekstinä |
| Tuotokset, Oma selain, Agentin käytössä | alarivin kuvakkeet merkkeineen | navigaattorin alarivi | alarivin kuvakkeet |
| Selainpyyntö toisesta keskustelusta | Oma selain -merkki + selainkuvake keskustelun omalla rivillä | `● 3` kattaa sen; Seuraava ja navigaattori kertovat | kortin teksti "Pyytää selainta" |
| Selitä | alarivin `?` | navigaattorin alarivin `?` | alarivin `?` |
| Tili ja asetukset | alarivin oikea reuna | navigaattorin alarivi | alarivin oikea reuna |
| Editori, pääte, keskustelun toiminnot | yläpalkin kuvakkeet ja `⋯` | sama + Seuraava niiden edessä | sama |
| Malli, konteksti | kentän rivi | kentän rivi | kentän rivi |

## Puhelin

Kaikissa suunnissa keskustelu täyttää puhelimen näytön, ja navigaatio tulee sen
päälle. Ero on siinä, mitä tulee.

```
1 Jono                      2 Kutsuttava                3 Katsaukset
┌──────────────────────┐    ┌──────────────────────┐    ┌──────────────────────┐
│☰³ Toimituskulut…  ▣ ⋯│    │(●3 ◌3) Toimit… [●→] ⋯│    │ ← Kaikki    Example ⌕│
│   atelier-site · ◌   │    │   atelier-site · ◌   │    │ SINUN VUOROSI 3      │
├──────────────────────┤    ├──────────────────────┤    │ ● Kevään kurssikal…  │
│ keskustelu           │    │ keskustelu           │    │   kurssit            │
│                      │    │                      │    │   ▭ Pyytää selainta… │
├──────────────────────┤    ├──────────────────────┤    │ ● Indigokokeiden…    │
│ [Kirjoita agentille ↑]│   │ [Kirjoita agentille ↑]│   │   Kysyy: yhdistetä…  │
└──────────────────────┘    └──────────────────────┘    └──────────────────────┘
 ☰ → laatikko: sama           (●3 ◌3) → navigaattori       lista on puhelimen
 sivupalkki 86 vw:n           koko korkeudelta, kenttä     juurinäkymä; keskustelu
 levyisenä scrimin päällä     kohdistettuna; Seuraava      avautuu sen päälle ja
                              pelkkänä nuolena             palaa nuolella
```

Prototyypissä suunnan 3 juurinäkymää vastaa koko leveyden laatikko.

Suunta 2 on puhelimessa luontevin, koska se on jo valmiiksi kutsuttava ja
Seuraava toimii yhdellä peukalolla. Siksi suosituksessa suunnan 2
Seuraava ja kutsuttava navigaattori ovat suunnan 1 kapean näytön muoto. Kuvat:
`check.mjs`:n `*-390-light-*-drawer.png`.

## Rajaus

Esityskielen kopio tokenien päällä, ei React-tuotantokomponentteja. Nykytila
luettiin tuotannon `WorkspaceRailView.tsx`:stä (`NowSections`, `QuietSection`,
`SearchDoor`, paikat), `NextWaitingDock.tsx`:stä, `switcherModel.ts`:stä,
yläpalkin toimintojen nimistä (`explainMode.ts` Y01–Y19, S01–S19), product.md:stä
ja design.md:stä. Palvelinkutsuja tai tallennusta ei ole. Kierros käyttää
yhteisiä `lib/picker.css`- ja `lib/picker.js`-tiedostoja ja
`picker-check.mjs`:ää. Kirjastoon ei koskettu.

## Rakentaminen ja tarkistus

Repojuuresta, kun lukitiedoston mukaiset `web/node_modules` on asennettu:

```sh
node design-system/prototypes/rounds/2026-11-22-ui-structure-2/build.mjs
PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" timeout 580 \
  node design-system/prototypes/rounds/2026-11-22-ui-structure-2/check.mjs \
  design-system/prototypes/dist/ui-structure-2/offline.html \
  /var/tmp/agent-keep/ui-structure-free-round/round2-check
```

Osoitevalinnat: `?v=1|2|3&lang=fi|en&theme=light|dark|contrast&bare=1`.
Linuxissa komennot ajetaan scratch-leasen alla, yksityisellä TMPDIR:llä ja
`umask 077`:llä, kuten repositoryn työohjeessa sanotaan.

Check mittaa ensin rivimäärät 1280×720:ssa, suunnassa 2 myös navigaattori
kutsuttuna, ja vertaa niitä ylärivin lukuihin suomeksi ja englanniksi. Sitten se
käy läpi 54 yhdistelmää: 3 suuntaa, 2 kieltä, 3 teemaa ja koot 1280×720,
1920×1080 ja 390×844. Se klikkaa neljä paikkaa (neljä eri kuvaketta, kolmella
sama muoto), `⋯`-valikon ja Escapen. Lisäksi se kokeilee jokaisen suunnan oman
navigaation:

- suunta 1: työtila avautuu hiljaisineen ja sulkeutuu
- suunta 2: kenttä saa fokuksen, haku suodattaa, Escape sulkee ja palauttaa
  fokuksen, Seuraava kulkee Sinun vuorosi -listan läpi, ja kiinnitys toimii
  edestakaisin
- suunta 3: valikossa on 10 työtilaa, ja rajaus koskee koko listaa

Lopuksi se avaa paletin tai navigaattorin painikkeesta ja Ctrl+K:lla, avaa
puhelimen laatikon ja sulkee sen scrimistä ja tarkistaa suuntavalitsimen. Sivu
ja kontrollit eivät vuoda vaakasuunnassa, konsoli on puhdas ja verkko on
estetty. Axe tarkistaa sovellusalueen 1280 px:n suomenkielisessä näkymässä
jokaisessa teemassa, suunnassa 2 myös navigaattori auki.
