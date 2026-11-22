# Koko käyttöliittymän rakenne — 22.11.2026

Vapaa kierros koko sovelluskehyksestä (issue `ui-structure-free-round`).
Akseli: **mikä on navigaatiota ja mikä työtä**, eli mihin kerrokseen kukin
nykyinen osa kuuluu. Näkymä on sama kaikissa: sovelluskehys, auki keskustelu
"Toimituskulut verkkokauppaan" (agentti työskentelee, ajaa testejä), 10
työtilaa ja 22 keskustelua. Kaikki nimet ovat keksittyjä.

Sivun yläreunan rivi kertoo suunnan eron ja sen, montako keskustelu- ja
työtilariviä mahtuu 1280×720-näkymään. Luvut eivät ole arvioita: `check.mjs`
mittaa täysin näkyvät rivit paljaasta sovelluksesta (`?bare=1`, ilman
arviointiriviä) ja kaatuu, jos rivin luku on eri. Arviointirivin Kartta-painike
näyttää alla olevan kartan sivulla.

## Suunnat

1. **Kaksi tasoa (suositus).** Vasen 64 px:n kaista on paikkoja: merkki
   (Etusivu), Kaikki, työtilat kirjainruutuina huomiomerkkeineen, alaosassa
   Tuotokset, Selain, Käytössä, Selitä ja tilin kuva. Viereinen 272 px:n palsta
   on pelkkiä keskusteluja: haku, Sinun vuorosi, Käynnissä ja Hiljaiset yhtenä
   vierityksenä koko korkeudelta. Työtilaruutu rajaa palstan siihen työtilaan
   ja sen otsikosta pääsee työtilan sivulle. Yläpalkissa vain otsikko, työtila,
   haara ja tila sekä nimetyt Editori ja Pääte ja `⋯`.
   1280×720: **17 keskustelua + 10 työtilaa** (1920×1080: kaikki 22 + 10).
2. **Yläpalkki.** Koko leveyden yläpalkki: merkki ja palvelin (Etusivu),
   keskellä haku/komentopaletti, oikealla Tuotokset, Selain, Käytössä, Selitä
   ja tili. Kapea sivupalkki on vain keskusteluja tiloittain, ja työtilat ovat
   sen alla pilleripilvenä. Editori, Pääte ja Tiedot ovat keskustelun
   välilehtiä samassa tilassa kuin keskustelu, ei sivupaneeleita.
   1280×720: **11 keskustelua + 10 työtilaa**.
3. **Työtila kotina.** Sivupalkissa vain työtilat (nimi ja tilamerkit) ja
   Huomio-painike, joka avaa Sinun vuorosi- ja Käynnissä-listat ponnahduksena.
   Pääalueen yläpalkki on työtilan: nimi, haara, muutokset ja työtilan
   työkalut Editori, Pääte ja Tiedostot. Sen alla keskustelut ovat
   välilehtinä (käynnissä olevat ja kaksi viimeksi luettua), muut
   Kaikki-listassa. 1280×720: **3 keskustelua (välilehdet) + 10 työtilaa**.

Neljä paikkaa (Etusivu, Tuotokset, Oma selain, Agentin käytössä) ratkaistaan
kaikissa samoin: jokaisella oma kuvake (talo / merkki, julkaistu sivu ja
nuoli ulos, selainikkuna, kilpi ja avaimenreikä), sama rivin tai painikkeen
muoto, eikä yksikään ole kortti. Selaimen valmius on pieni vihreä piste ja
vihjeteksti. Tämän keskustelun selainikkunat avautuvat kentän yllä olevasta
sirusta kuten `server-browser-entry`-kierroksen suosituksessa (Molemmat).
`check.mjs` tarkistaa, että kuvakkeita on neljä erilaista ja että kolme
paikkaa jakavat yhden luokan.

## Kartta: nykyinen osa → missä se nyt asuu

| Nykyinen | 1 Kaksi tasoa | 2 Yläpalkki | 3 Työtila kotina |
|---|---|---|---|
| Palvelimen nimi ja yhteys | kaistan merkki, vihjeessä | yläpalkin vasen reuna | sivupalkin yläpää |
| Etusivu | merkki | merkki ja nimi | merkki ja nimi |
| Tuotokset | kaistan alaosa | yläpalkki, kuvake + nimi | paikkojen ruudukko |
| Oma selain | kaistan alaosa + siru | yläpalkki + siru | ruudukko + siru |
| Agentin käytössä | kaistan alaosa | yläpalkki | ruudukko |
| Haku (⌘K) | palstan yläpää → paletti | yläpalkin keskellä → paletti | sivupalkki → paletti |
| Sinun vuorosi / Käynnissä | palsta | kapea palkki | Huomio-ponnahdus |
| Hiljaiset | palsta, sama vieritys | kapea palkki | työtilan Kaikki-lista |
| Hiljaisten työtilarajaus (pillerit) | työtilaruutu rajaa koko palstan | — | työtila on aina rajaus |
| Työtilat | kaistan ruudut | pilleripilvi | sivupalkin päälista |
| Uusi työtila / uusi keskustelu | kaistan `+` / palstan `+` | pilvi / palkin `+` | listan `+` / välilehtien `+` |
| Apulaiset | oma rivi Käynnissä | sama | oma välilehti |
| Editori, pääte | otsikon nimetyt painikkeet | keskustelun välilehdet | työtilan palkki |
| Tiedostot | editorin puu | Editori-välilehti | työtilan palkki |
| Selitä (oli otsikon `?`) | kaistan alaosa | yläpalkki | ruudukko |
| Tilannekatsaus, uusi otsikko, tiedot, arkistoi | `⋯` | `⋯`, tiedot myös välilehti | `⋯` |
| Malli (oli otsikossa ja kentässä) | vain kentän rivillä | sama | sama |
| Git-haara | otsikon toinen rivi | otsikon toinen rivi | työtilan palkki |
| Tili ja asetukset | kaistan alin kuva | yläpalkin oikea reuna | sivupalkin alareuna |

## Puhelin (suositeltu suunta 1)

Puhelimessa keskustelu on koko näkymä ja yläpalkissa on valikkopainike, jonka
merkki kertoo odottavien määrän. Valikkolaatikko avaa molemmat tasot rinnakkain:
kaista vasemmalla, keskustelupalsta sen vieressä. Työtilaruutu rajaa palstan
paikallaan, eikä erillistä työtilanäkymää tarvita. Editori ja Pääte kutistuvat
kuvakkeiksi numeroineen, ja `⋯` kokoaa loput.

```
┌──────────────────────────┐      ┌────┬─────────────────────┐
│ ☰³ Toimituskulut…  ▣ >_ ⋯│      │ ◐  │ Kaikki työtilat   + │
│ atelier-site · main · ◌  │      │ ▦  │ [Hae tai komenna ⌘K]│
├──────────────────────────┤      │ AT•│ SINUN VUOROSI 3     │
│                          │ ☰ →  │ BU │  KU Kevään kurssi… ●│
│   keskustelu             │      │ DY¹│ KÄYNNISSÄ 3         │
│                          │      │ …  │  AT Toimituskulut  ◌│
├──────────────────────────┤      │────│ HILJAISET           │
│ [▭ Tämän keskustelun 1]  │      │ ⇪¹ │  …                  │
│ [Kirjoita agentille…   ↑]│      │ ▭• │                     │
└──────────────────────────┘      │ ⛨  │                     │
                                  │ (R)│                     │
                                  └────┴─────────────────────┘
```

Suunta 2 pitää paikat puhelimen yläpalkissa kuvakkeina, ja laatikossa on vain
keskustelupalkki. Suunnassa 3 laatikko on työtilalista, ja välilehdet
vierivät vaakasuunnassa. Molemmat näkyvät `check.mjs`:n `*-390-*-drawer`-kuvissa.

## Rajaus

Esityskielen kopio tokenien päällä, ei React-tuotantokomponentteja. Tuotannon
`WorkspaceRailView.tsx`, keskustelun yläpalkin toiminnot (`explainMode.ts`:n
nimet Y05–Y14) ja kentän sirut luettiin, ja nykytilaa katsottiin Jarin
kannettavan kuvista (ei talletettu). Ei palvelinkutsuja eikä tallennusta.
Kierros käyttää yhteisiä `lib/picker.css`- ja `lib/picker.js`-tiedostoja ja
`picker-check.mjs`:ää; kirjastoon ei koskettu.

## Rakentaminen ja tarkistus

Repojuuresta, lukitiedoston mukaiset `web/node_modules` asennettuina:

```sh
node design-system/prototypes/rounds/2026-11-22-ui-structure/build.mjs
PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" timeout 580 \
  node design-system/prototypes/rounds/2026-11-22-ui-structure/check.mjs \
  design-system/prototypes/dist/ui-structure/offline.html \
  /var/tmp/agent-keep/ui-structure-free-round/check
```

Osoitevalinnat: `?v=1|2|3&lang=fi|en&theme=light|dark|contrast&bare=1`.
Linuxissa komennot ajetaan scratch-leasen alla, yksityisellä TMPDIR:llä ja
`umask 077`:llä kuten repositoryn työohjeessa.

Check mittaa ensin rivimäärät ja vertaa niitä arviointiriviin (fi ja en).
Sitten se käy 54 yhdistelmää: kolme suuntaa, kaksi kieltä, kolme teemaa,
1280×720, 1920×1080 ja 390×844. Se klikkaa neljä paikkaa, `⋯`-valikon,
Escape-sulkemisen, suunnan oman rakenteen (1: työtilarajaus, 2: Editori-
välilehti, 3: Huomio-lista ja työtilan vaihtuminen, Kaikki-lista), paletin
painikkeesta ja Ctrl+K:lla, puhelimen laatikon ja suuntavalitsimen. Sivu ja
kontrollit eivät vuoda vaakasuunnassa, konsoli on puhdas ja verkko estetty.
Axe tarkistaa sovellusalueen 1280 px:n suomenkielisessä näkymässä joka
teemassa. Kuvat ovat ihmisen arvioitavaksi.
