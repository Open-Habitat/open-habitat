# Kentän listat – kierros 4

Issue `proto-composer-popover-placement`. Jari valitsi 6.11. kierroksen 3
suunnan *Puu* ja pyysi riffaamaan haun: miten käsitellään esimerkiksi
`AGENTS.md`, joka on monessa kansiossa.

Akseli: mitä puusta tulee, kun hakuun kirjoitetaan nimi, joka löytyy monesta
kansiosta. Ilman hakua kaikki kolme ovat kierroksen 3 Puu sellaisenaan.

0. **Nyt**: haku on tasainen lista koko polkuineen sumean osuman mukaan, lyhyin polku ensin; muutos ei vaikuta järjestykseen, ja AGENTS.md-tiedostot erottaa polun alusta.
1. **Puussa**: haku karsii puun osumien kansioihin, kansiot auki; kansion oma osuma ennen alikansioita, joten juuren AGENTS.md on ylimpänä.
2. **Lista**: haku litistää puun yhdeksi listaksi, nimi ensin ja kansio sen perässä; paras nimiosuma ylimpänä, sitten muutetut ja matalimmat; → näyttää kansiossa.
3. **Nimi**: saman nimen tiedostot yhden nimirivin alla, kansiot sen alla; nimen voi merkitä, jolloin kaikki lisätään.

Suositus: **Lista**.

Oletusnäkymä on pitkä luonnos, jossa *Tiedosto* on auki napista ja hakuun on
kirjoitettu `AGENTS`. Synteettisessä työtilassa `AGENTS.md` on juuressa sekä
kansioissa `docs/`, `src/` (muutettu), `src/astro/` ja `tests/`. Sivun
yläreunasta voi vaihtaa haun (`AGENTS`, `test`, `shadow`, tyhjä) ja
järjestyksen (*Muutetut ensin* tai *Matalimmat ensin*). Järjestys vaikuttaa
Listaan ja Nimeen.

## Mikä on kaikissa kolmessa samaa

- Selaus ilman hakua on kierroksen 3 Puu: muutoksia sisältävät kansiot ovat
  auki, muutettu tiedosto näkyy Git-merkillä ja lihavoituna, esikatselu on
  työpöydällä vieressä ja puhelimessa sitä ei ole.
- Otsikkorivillä lukee haun aikana *5 osumaa* ja selatessa *5 muutettua*.
- Haun alussa valittuna on aina tiedosto, ei kansio- tai nimirivi, joten
  Enter lisää heti tiedoston ja esikatselu näyttää sen.
- Kirjoitetussa `@AGENTS`-listassa Tab täydentää ylimmän tiedoston kuten
  Pi:n päätteessä. Puussa se on juuren `AGENTS.md`, Listassa ja Nimessä
  muutettu `src/AGENTS.md` (järjestyksellä *Muutetut ensin*).
- Kierroksen 2 säännöt pysyvät: ei välidialogia, usean valinta
  valintaruudulla tai Tabilla, Esc palauttaa tekstiin samaan kohtaan,
  `!`-komento saa pelkän polun, komento menee viestin alkuun.

## Mitä kukin päättää

- **Puussa** pitää puun myös haun aikana. Mukana ovat vain kansiot, joissa
  on osuma, ja ne ovat auki. Kansion omat osumat tulevat ennen sen
  alikansioita (selatessa järjestys on toisin päin), joten matalin on
  ylimpänä ja syvin alimpana. Järjestys on rakenne, joten muutettu ei nouse.
  Viisi osumaa vie yhdeksän riviä, ja puhelimessa sisennys vie leveyttä.
  ← ja → sulkevat ja avaavat kansion haun aikanakin.
- **Lista** unohtaa puun haun ajaksi. Jokainen osuma on yksi rivi: nimi
  täydellä musteella ja kansio sen perässä himmeänä (puhelimessa nimen
  alla). Juuren kansiona näkyy työtilan nimi `aurinkokello/`. Järjestys:
  koko nimi osuu ennen nimen osaa, nimen osa ennen pelkkää polkua, ja
  saman tason sisällä muutetut ensin ja sitten matalimmat (tai toisin päin
  valitsimesta). → vie tiedoston puuhun: haku tyhjenee, puu aukeaa sen
  kansioon ja sama tiedosto on valittuna.
- **Nimi** kokoaa saman nimen tiedostot yhden *AGENTS.md · 5 kansiossa*
  -rivin alle, ja kansiot ovat sen alla samassa järjestyksessä kuin
  Listassa. Kertaalleen löytyvä nimi on tavallinen rivi kuten Listassa.
  Nimirivin ruutu merkitsee kaikki viisi (*5 valittu · Lisää 5 polkua*).
  ← vie nimiriville ja sulkee sen, → avaa. Enter nimirivillä siirtyy sen
  ensimmäiseen kansioon. Haku, jossa ei ole samannimisiä (`shadow`), näyttää
  samalta kuin Lista.

## Suositus

**Lista.** Haussa ihminen etsii nimeä, ja Lista näyttää jokaisen osuman
yhdellä rivillä, jossa nimi on ensin ja kansio erottaa samannimiset. Viisi
`AGENTS.md`:tä on viisi riviä, eikä puhelimessa tarvita sisennystä. Puu jää
selaamiseen, ja → vie osuman puuhun, kun sen naapurit kiinnostavat. Puussa
näyttää saman rakenteen, mutta lista on lähes kaksi kertaa pidempi, ja
järjestys on aina rakenteen järjestys, joten muutettu `src/AGENTS.md` ei
nouse. Nimen *lisää kaikki* on hyvä, mutta harvoin tarvittu, ja nimirivi on
ylimääräinen askel joka haussa, jossa on samannimisiä.

Järjestyksestä suosittelen *Muutetut ensin*: kesken olevaa työtä mainitaan
useimmin, ja sama sääntö pätee jo selaukseen ja nykyiseen listaan ilman
hakua. Saman tason sisällä matalin tulee sen jälkeen.

## Host-tiedot

Daemon (`workspace_composer_files_linux.go`) palauttaa haulla enintään 200
osumaa sumean pisteytyksen mukaan koko polusta: lyhyempi polku voittaa
hieman, eikä muutos vaikuta järjestykseen. Ilman hakua järjestys on Gitin
(prototyypin Nyt tekee samoin). Puussa tarvitsee vain osumien polut ja
Git-merkit, eli nykyisen vastauksen. Lista ja Nimi järjestävät nimiosuman,
muutoksen ja syvyyden mukaan. Selain voi tehdä sen palautetuille osumille,
mutta isossa työtilassa 200:n raja leikkaa ennen sitä, joten oikea paikka
on daemonin järjestys: nimiosuman taso ensin ja muutettu ja syvyys
tasapelin ratkaisijoina. Se on nykyisen tiedostohaun muutos, ei uusi
tallennus. Kansiot ja puuhun vienti johdetaan poluista.

## Rakentaminen ja tarkistus

```
cd web && npm ci            # jos node_modules puuttuu
node design-system/prototypes/rounds/2026-11-06-kentan-listat-4/build.mjs
PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright \
  node design-system/prototypes/rounds/2026-11-06-kentan-listat-4/check.mjs \
  design-system/prototypes/dist/kentan-listat-4/offline.html <kuvahakemisto>
```

`check.mjs` käy jokaisen suunnan läpi vaaleana ja tummana 1440 ja 390 px
leveydellä. Se tarkistaa oletushaun viisi `AGENTS.md`:tä kussakin muodossa
(karsittu puu ja juuri ensin, litteä lista molemmilla järjestyksillä ja →
puuhun, nimirivi, sen avaus ja sulku sekä viiden merkintä), kahden tiedoston
merkinnän näppäimillä tai napautuksin, selauksen kierroksen 3 Puuna, Escin,
komennot viestin alkuun, kirjoitetun `@AGENTS`-merkinnän ja Tabin, keskellä
riviä olevan `/`-merkin, painalluksen tekstiin ja ulkopuolelle, lyhyen
luonnoksen, `!`-komennon polun sekä hitaan, epäonnistuneen ja tyhjän haun.

Nyt on tuotannon `Composer` muuttamattomana, ja sen synteettinen tiedostohaku
järjestää osumat kuten daemon. Suunnat 1–3 ovat kierroksen `infield.tsx`,
joka käyttää tuotannon merkintää ja tyylejä (`.ah-cbox`, `.ah-crow`,
`.ah-choice-*`, `.ah-pal-prev`), komponentteja (`Icon`, `GitBadge`,
`AttachmentMenu`) ja tekstisääntöjä (`completion.ts`). Toteutus kuuluisi
`Composer.tsx`:n kentän listaan, `ChoiceList.tsx`:n riveihin (nimi ja kansio
perässä) ja daemonin `matchComposerFiles`-järjestykseen. Tekstit menisivät
`composer`- ja `choiceList`-katalogeihin molemmilla kielillä.
