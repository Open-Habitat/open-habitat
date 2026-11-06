# Kentän listat – kierros 3

Issue `proto-composer-popover-placement`. Jari kierroksesta 2 (6.11.):
*Välilehdet*-suunnan esikatselu tulee mukaan. *Muutetut* ei ole oma
välilehti, koska muutos on tiedoston tila, joten se näytetään suoraan
listassa. Kansiopuulla selataan tiedostoja.

Akseli: miten muutetut tiedostot löytyvät kansiopuusta ilman omaa
välilehteä tai kansiota.

0. **Nyt**: lista avautuu kentän yläpuolelle; muutetut ja esikatselu ovat vain Ctrl/⌘+P-valitsimen välilehdillä koko näkymän päällä.
1. **Ylhäällä**: kansio kerrallaan polkurivillä; kansion muutetut tiedostot ovat listan ylimmät rivit merkkeineen, sitten kansiot ja muut tiedostot; esikatselu vieressä.
2. **Puu**: sisennetty puu, jossa muutoksia sisältävät kansiot ovat valmiiksi auki, joten muutetut näkyvät paikallaan merkkeineen; esikatselu vieressä.
3. **Sarake**: kansiot omana sarakkeenaan muutosmäärineen; keskellä valitun kansion kaikki tiedostot muutetut ensin; esikatselu oikealla.

Suositus: **Ylhäällä**.

Ero kierrokseen 2 näkyy oletusnäkymässä (pitkä luonnos, *Tiedosto* auki
napista). Välilehtiä ei ole. Muutetut tiedostot näkyvät listassa
tuotannon Git-merkillä (`M`, `U`) ja lihavoituna nimenä. Esikatselu on
listan vieressä kaikissa kolmessa suunnassa.

## Mikä on kaikissa kolmessa samaa

- Kierroksen 2 yhteiset säännöt pysyvät ennallaan. Välidialogia ei ole, ja
  napit ja Ctrl/⌘+P avaavat saman listan kentän sisään. Usean valinta
  tehdään valintaruudulla tai Tabilla, ja *2 valittu · Lisää 2 polkua*
  -rivi kertoo, mitä lisätään. Kirjoitettu `@` tai `/` avaa listan
  kursorin kohdalle, ja Tab täydentää tiedoston. Esc palauttaa
  kohdistuksen tekstiin samaan kohtaan, ja lisäys toimii kuten nyt
  (`@polku`, `!`-komennossa pelkkä polku, komento viestin alkuun).
  Tilatekstit ovat tuotannon.
- **Muutos on rivin tila.** Muutetulla tiedostolla on tuotannon Git-merkki
  (`M` muutettu, `U` uusi), ja nimi on lihavoitu. Kansiorivin luku kertoo,
  montako muutettua kansion alla on. Esikatselu kertoo tilan sanoin
  (*Muutettu: muutokset viimeisimpään committiin.* tai *Uusi tiedosto, ei
  vielä Gitissä.*) ja näyttää muutetusta tiedostosta diffin, muusta
  tiedostosta alun ja kansiosta sen sisällön.
- **Esikatselu** on työpöydällä listan oikealla puolella kuten
  Välilehdissä. Se seuraa valittua riviä ja näyttää myös komennon kuvauksen
  ja sen, mitä lisäys tekee. Puhelimessa esikatselu jää pois kuten
  nykyisessä valitsimessa.
- **Komennot** ovat ryhmissä Taidot, Pohjat ja Laajennukset, ja niidenkin
  esikatselu on vieressä. Ctrl/⌘+P vaihtaa tiedostojen ja komentojen välillä.

## Mitä kukin päättää

- **Ylhäällä** on kierroksen 2 Kansiopuu ilman *Muutetut*-kansiota.
  Kansion muutetut tiedostot nostetaan listan alkuun polkuineen
  kansiosta katsottuna (`src/shadow.py`, `astro/refraction.py`), ja
  niiden alla ohut viiva erottaa kansion oman sisällön. Muutettua
  tiedostoa ei näytetä toiseen kertaan. Polkurivi, → kansioon, ← ylös ja
  kirjoitettu `@src/as` toimivat kuten kierroksella 2. Avattaessa valittuna
  on ensimmäinen muutettu tiedosto, joten esikatselussa näkyy heti sen
  diff.
- **Puu** näyttää koko työtilan yhtenä sisennettynä puuna. Kansio, jonka
  alla on muutoksia, on valmiiksi auki, ja muut ovat kiinni. Muutetut
  näkyvät siis paikallaan puussa. Painallus kansioon avaa tai sulkee sen
  paikallaan, ja → avaa ja ← sulkee tai siirtyy ylempään kansioon. Haku
  näyttää osumat puussa kansiot auki. Valittuna on aluksi ensimmäinen
  muutettu tiedosto. Otsikkorivillä lukee *4 muutettua*. Puu on pisin
  lista, joten syvällä oleva muutos voi jäädä vierityksen taakse.
- **Sarake** jakaa listan kolmeen sarakkeeseen. Vasemmalla ovat kaikki
  kansiot muutosmääriin, keskellä valitun kansion kaikki tiedostot
  alikansioineen muutetut ensin ja oikealla esikatselu. Kansion valinta
  rajaa listan ja haun, ja ← ja → vaihtavat kansiota, kun haku on tyhjä.
  Komennoissa vasen sarake on Kaikki, Taidot, Pohjat ja Laajennukset.
  Puhelimessa sarakkeesta tulee pyyhkäistävä kansiorivi. Kansion voi
  merkitä sarakkeen ruudusta, joka näkyy hoverissa. Sarakkeet tekevät
  polut ja esikatselun kapeiksi.

## Suositus

**Ylhäällä.** Kun lista avautuu, siinä on ensin juuri ne tiedostot, joista
useimmiten kerrotaan agentille, eli muutetut, ja ensimmäisen diff näkyy
heti esikatselussa. Tämä on sama lähtökohta kuin nykyisessä
tiedostolistassa, jossa muutetut ovat ensin. Muutetut eivät silti ole
erillinen paikka, koska sama sääntö pätee jokaisessa kansiossa: `src/`:ssä
ylimpänä ovat `src/`:n muutetut. Kansiot näkyvät heti viivan alla, ja
polkurivi ja `@src/` toimivat kuten Pi:n päätteessä. Puu näyttää muutokset
paikallaan, mutta lista kasvaa pitkäksi heti, kun muutoksia on useassa
kansiossa. Sarake on selkein selattava, mutta 730 px:n kentässä kolme
saraketta kaventaa polut ja esikatselun, ja puhelimessa se muuttuu joka
tapauksessa toiseksi.

## Host-tiedot

Esikatselu käyttää nykyistä esikatselulukua (`sources.preview`: muutetusta
diff, muuten alku). Ylhäällä ja Puu tarvitsevat saman kuin kierroksen 2
Kansiopuu: kansion suorat lapset ja alikansioiden muutosmäärät myös
silloin, kun työtilassa on yli 200 tiedostoa. Daemon palauttaa nyt enintään
200 osumaa, muutetut ensin. Puu tarvitsee lisäksi auki olevien kansioiden
sisällön kerralla, eli muutettujen polut ja niiden kansioiden lapset.
Sarake tarvitsee kansioluettelon muutosmäärineen ja kansion kaikki
tiedostot. Isossa työtilassa kansioluettelo pitää lukea kansio kerrallaan.
Kaikki nämä ovat nykyisen tiedostohaun laajennuksia, eivät uutta
tallennusta. Prototyypin työtila on synteettinen ja suodatetaan selaimessa
samalla sumealla haulla kuin daemonissa.

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-06-kentan-listat-3/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-kentan-listat-3/check.mjs \
  design-system/prototypes/dist/kentan-listat-3/offline.html <kuvahakemisto>
```

`check.mjs` käy läpi jokaisen suunnan vaaleana ja tummana 1440 ja 390 px
leveydellä. Se tarkistaa oletusnäkymän: välilehtiä ei ole, muutetut ovat
oikeassa kohdassa ja esikatselu seuraa valittua riviä työpöydällä, ja
puhelimessa sitä ei ole. Lisäksi se tarkistaa kahden tiedoston merkinnän
näppäimillä tai napautuksin, kansiot (polkurivi, puun avaus ja sulkeminen
hiirellä ja nuolilla, sarakkeen kansiot), Escin, komennot viestin alkuun,
kirjoitetun `@`-merkin ja Tabin, keskellä riviä olevan `/`-merkin,
painalluksen tekstiin ja ulkopuolelle, lyhyen luonnoksen, `!`-komennon
polun sekä hitaan, epäonnistuneen ja tyhjän haun. Tarkistuspisteitä on
504, ja konsoli on puhdas. Kuvat otetaan kertoimella 2.

Nyt on tuotannon `Composer` muuttamattomana. Suunnat 1–3 ovat kierroksen
`infield.tsx`, joka käyttää tuotannon merkintää ja tyylejä (`.ah-cbox`,
`.ah-crow`, `.ah-choice-*`, `.ah-pal-prev`), komponentteja (`Icon`,
`GitBadge`, `AttachmentMenu`) ja tekstisääntöjä (`completion.ts`).
Toteutus kuuluisi `Composer.tsx`:n `Open`-tilaan (palette-tila pois,
esikatselu ja merkinnät kentän listaan), `ChoiceList.tsx`:n riveihin
(kansiorivi, merkintäruutu ja muutettu-tila) ja `composer.css`:ään. Tekstit
menisivät `composer`- ja `choiceList`-katalogeihin molemmilla kielillä.
