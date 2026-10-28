# Tulos: keskustelun otsake työpöydällä

Prototyyppi on `prototypes/conversation-header/index.html`, yksi offline-HTML.
Se on käsin kirjoitettu sivu (`design-system/prototypes/rounds/2026-10-28-keskustelun-otsake/page.html`),
jonka `build.mjs` täydentää tokeneilla, upotetuilla fonteilla ja yhteisellä
valitsimella (`lib/picker.*`). Tuotantokomponenttien bundlea ei käytetä, koska
sellainen jää Habitatin näkymissä tyhjäksi. Opas on
`prototypes/conversation-header/NOTES.md`. Kuvat ovat `evidence/`-hakemistossa
laitteen skaalauksella 2, ja mittaukset ovat tiedostossa `evidence/metrics.json`.

Nykytila on luettu koodista: `AgentHeader` (`web/src/components/Navigation.tsx`),
`components.css` (`.ah-agent-topline`, container query `conversation-header`),
`GitStatus.css`, `EditorSplit.css` ja `app/editor.ts` (keskustelusarake
editorin vieressä: `min(640, max(440, 0,3 × leveys))`). Labia ei ajettu, koska
otsakkeen asettelu on kokonaan näissä tiedostoissa. **Nykyinen** ja **Aiempi**
toistavat tuotannon säännöt sivun omassa merkinnässä. Aiempi on yksirivinen
otsake ennen issueta `desktop-header-title-squeezed`.

## Akseli: mihin tila väistyy, kun rivi loppuu

Kaikissa kolmessa suunnassa otsake on aina yksi rivi (59 px, sama kuin
tuotannon yksirivinen). Otsikko saa vähintään 40 % rivistä tai koko tekstinsä.
Kaikissa suunnissa on myös sama kevennys: tilasiruilla ei ole reunaviivaa eikä
taustaa (tausta tulee vain osoittimen alla), aktiviteetti on piste ja teksti
ilman pilleriä, ja Git-nollalaskurit jäävät pois (`main ↑1` eikä
`main ↑1 ↓0 ●0`). Suunnat eroavat siinä, mitä tapahtuu, kun tila ei riitä.

| # | Suunta | Mitä se päättää | Milloin oikea | Mitä se maksaa |
|---|---|---|---|---|
| 1 | **Lyhenee** | Kaikki pysyy yläpalkissa ja lyhenee vaiheittain: työtila → ajattelutaso → aktiviteetin teksti (piste jää) → kontekstin prosentti (rengas jää) → haaran nimi 12 merkkiin → haaran nimi pois (laskurit jäävät) → mallin nimi 8 merkkiin → Uusi otsikko, Arkistoi ja Tiedot ⋯-valikkoon → tiedostomäärä → Git-laskurit → malli. Viimeiset vaiheet tarvitaan vain editorin vieressä. | Jos haluat nähdä vilkaisulla kaiken, edes merkkinä. | Lyhennetyt sirut ovat arvoituksia (pelkkä haaraikoni ja rengas), ja oikea teksti on vain vihjeessä. Pitkällä haaralla ja mallinimellä 1280 px:ssä sivupalkki auki haaran nimi on poissa ja malli on "Opus 5.5 …". Jarin kuvan sisällöllä samassa tilassa pois jäävät vain työtila ja "Medium". |
| 2 | **Valikkoon** | Sirut pysyvät kokonaisina, ja ne, jotka eivät mahdu, siirtyvät kokonaan ⋯-valikkoon täysinä riveinä tässä järjestyksessä: työtila → konteksti → Git → malli → Uusi otsikko → Arkistoi → Tiedot. Lopuksi aktiviteetti jää pelkäksi pisteeksi ja tiedostomäärä katoaa. | Jos rivillä saa olla vähemmän, kunhan se mikä näkyy, on luettavaa. | Git ja konteksti katoavat näkyvistä jo 1280 px:n leveydellä sivupalkki auki (1600 px:ssäkin pitkällä otsikolla). Niiden muutoksen huomaa vain avaamalla valikon. |
| 3 | **Kentän luo** | Yläpalkissa on vain otsikko, aktiviteetti ja toiminnot. Malli, ajattelutaso, konteksti, työtila ja Git ovat hiljaisella rivillä kentän alla. Ne koskevat seuraavaa viestiä ja sitä, mihin se menee. Ahtaassa sarakkeessa kentän alarivi lyhenee samassa järjestyksessä kuin suunnassa 1. | Jos otsikolle halutaan eniten tilaa ja mallin vaihto halutaan sinne, missä kirjoitetaan. | Kentän alle tulee 28 px:n rivi, joten lanka ei lyhene, vaan korkeus siirtyy yläpalkista alas. Git ja työtila ovat kaukana otsikosta. Puhelimessa rivi vie tilaa näppäimistön yläpuolelta. |

Mitattu otsikon leveys pitkällä otsikolla (`metrics.json`; otsikon koko teksti
on noin 650 px leveä, 1920:ssa leveämpi otsikkorivi näyttää koko tekstin):

| Sivupalkki auki | 1024 | 1280 | 1600 | 1920 |
|---|---|---|---|---|
| 1 Lyhenee | 308 | 419 | 562 | 882 (koko) |
| 2 Valikkoon | 306 | 521 | 600 | 920 (koko) |
| 3 Kentän luo | 306 | 562 | 882 (koko) | 1202 (koko) |
| Nykyinen (2 riviä alle 80rem, 93 px korkea) | 421 | 677 (koko) | 997 (koko) | 647 (1 rivi) |
| Aiempi | 0 | 51 | 371 | 691 (koko) |

Jarin kuvan sisällöllä (lyhyt otsikko, `main`, `Opus 5.5`) otsikko näkyy
kokonaan kaikissa kolmessa suunnassa kaikilla leveyksillä. Aiemmassa otsikolle
ei jää 1024 px:ssä mitään.

Editorin vieressä (keskustelusarake 440 px, 1920:ssa 486 px) otsikolle jää 1:ssä
155 px, 2:ssa ja 3:ssa 183 px. Nykyisessä otsikolle jää 132 px, mutta otsake on
kolmirivinen (122 px). Aiemmassa otsikolle ei jää mitään.

Huomio nykyisestä: kahden rivin kynnys on otsakkeen leveys 80rem. Siksi
1600 px:n ikkunassa sivupalkki auki otsikko näkyy kokonaan kahdella rivillä,
mutta 1920 px:ssä yhdellä rivillä siitä katkeaa loppu. Leveämpi ikkuna antaa
otsikolle vähemmän tilaa.

## Host-tiedot, joita suunnat tarvitsevat

Mikään suunta ei tarvitse daemonin, gatewayn, provisionin tai sopimuksen
(`contracts/v1/`) muutosta. Kaikki näytettävä tieto on jo selaimessa.

| Tieto tai rakenne | Onko olemassa |
|---|---|
| Otsikko, työtila, aktiviteetti, Git-tila, konteksti, malli ja ajattelutaso otsakkeessa | **On**: `AgentHeader`n propsit (`gitStatus`, `contextIndicator`, `modelPicker`/`settings`). |
| Git-laskurit erikseen, jotta nollat voi jättää pois | **On**: `GitStatus` piirtää laskurit omina elementteinään (`.ah-gs-n`). Nollan piilotus on esityksen päätös. |
| Otsakkeen ⋯-valikko | **Osittain.** Puhelimen `Menu` (`.ah-header-more`, `phoneMenu`) on olemassa ja sisältää työtilan, uuden otsikon, arkistoinnin ja tiedot. Työpöydällä se on piilossa. Suunnat 1 ja 2 tarvitsevat sen myös työpöydälle. Suunta 2 tarvitsee siihen lisäksi tilarivit (Git, konteksti, malli), joiden painallus avaa saman ponnahduksen kuin siru. |
| Vaiheittainen tiivistys sarakkeen leveyden mukaan | **Osittain.** Container query `conversation-header` on olemassa. Suunta 1 ja 3 voidaan toteuttaa kynnyksinä (rem-rajat) tai ResizeObserverilla, joka kokeilee vaiheita, kuten prototyyppi tekee. Suunta 2 tarvitsee mittauksen (priority+), koska valikon sisältö riippuu siitä, mikä jäi pois. |
| Mallivalitsin ja konteksti kentän alla (suunta 3) | **Osittain.** `modelPicker` ja `contextIndicator` ovat `ReactNode`ja, joten ne voi piirtää `ConversationFrame`n kenttäalueelle. Kentän korkeuslaskenta (`--ah-composer-height`, kelluvat kontrollit) on päivitettävä alarivin mukaan. |

## Suositus

**1 Lyhenee.** Se ratkaisee Jarin havainnon suoraan: otsake on taas yksi kevyt
rivi kaikilla neljällä leveydellä, otsikko on luettava eikä mitään tilatietoa
tarvitse etsiä valikosta. Tavallisella sisällöllä (Jarin kuva) lyhenemistä
tuskin huomaa, koska vain työtila ja ajattelutaso jäävät pois. Kevennys (ei
reunaviivoja, ei Git-nollia, aktiviteetti ilman pilleriä) tekee suurimman osan
"raskas ja ruma" -korjauksesta. Se on sama kaikissa suunnissa, joten sen voi
toteuttaa valinnasta riippumatta.

Suunta 2 on puhtain kuva, mutta piilottaa Gitin ja kontekstin juuri niillä
leveyksillä, joilla Jari työskentelee. Suunta 3 on vahva, jos malli halutaan
kentän viereen muutenkin. Se on kuitenkin suurempi muutos (kenttäalueen
korkeus, puhelin), eikä se ole otsakkeen korjaus vaan tilarivin siirto.

## Päätökset myöhempää tarkistusta varten

- **Otsikon osuus 40 % rivistä.** Tuotannon yksirivinen tila käyttää 33 %.
  33 %:lla otsikosta jää 1280 px:ssä noin 310 px, mikä on alle 40 merkkiä.
  50 % olisi vaatinut 1280:ssa jo mallin lyhentämisen. Prototyypin
  `TITLE_SHARE` on yksi vakio, joten osuuden voi vaihtaa.
- **Git-nollat pois kaikissa suunnissa.** Vaihtoehto: pidetään nollat, kuten
  Git-tilan kierros 2026-10-17 päätti. Pois, koska nollat ovat yleisin tila ja
  ne tekevät sirusta pisimmän. Täydet luvut ovat sirun vihjeessä ja
  ponnahduksessa.
- **Sirut ilman reunaviivaa.** Vaihtoehto: reunaviiva vain mallivalitsimessa,
  koska se on ainoa siru, joka avaa valinnan. Valitsin yhden tyylin, koska myös
  Git avaa ponnahduksen. Ero tuotannon `ControlButton presentation="pill"`
  -tyyliin pitää ratkaista toteutuksessa: joko uusi `quiet`-esitys tai
  otsakkeen oma sääntö.
- **Työtila lähtee ensimmäisenä.** Se näkyy sivupalkissa, kun palkki on auki,
  ja sen saa ⋯-valikosta. Kun palkki on kiinni, työtila voisi pysyä pidempään.
  Tätä ei tehty, jotta järjestys pysyy yhtenä.
- **Työpöydällä on ⋯-valikko editorin vieressä (suunnat 1 ja 2).** Edellinen
  korjaus päätti, ettei työpöydällä siirretä toimintoja valikkoon. Yhdellä
  rivillä 440 px:n sarakkeessa kuusi ikonia ja otsikko eivät mahdu. Valikkoon
  siirtyvät vain harvoin käytetyt (Uusi otsikko, Arkistoi, Tiedot), ja vain
  silloin, kun muu ei riitä.
- **Puhelin.** Suunta 1 pitää puhelimen nykyisen kaksirivisen asettelun
  hiljaisilla siruilla. Tiedostot ovat ensimmäisellä rivillä muiden
  paneelien kanssa, ja ajattelutaso jää pois. Suunta 2 on puhelimessa yksi rivi,
  ja kaikki tila on valikossa. Suunta 3 on yksi rivi, ja tila on kentän alla.
  Issue koski työpöytää, joten puhelin on mukana vain, jotta suunnan seuraus
  näkyy.

## Kysymykset Jarille

1. Mikä suunnista (1 Lyhenee, 2 Valikkoon, 3 Kentän luo)?
2. Riittääkö pelkkä kevennys (sama kaikissa) jo, jos kahden rivin kynnystä
   lasketaan? Tämä olisi pienin muutos tuotantoon.
3. Saako työpöydällä olla ⋯-valikko kapeassa sarakkeessa?

## Tarkistus

`verify.mjs` rakentaa sivun ja käy läpi 115 tapausta: viisi vaihtoehtoa,
leveydet 1024, 1280, 1600 ja 1920, sivupalkki auki ja kiinni, editori auki,
Jarin kuvan sisältö, vaalea ja tumma sekä puhelin 390 px. Kolmessa suunnassa
se varmistaa työpöydällä, että otsake on yksi rivi, mikään ei mene päällekkäin
tai yli eikä kentän alarivi vuoda yli, ja että otsikolla on vähintään 40 %
rivistä tai koko tekstinsä. Se avaa suunnan 2 valikon editorin vieressä,
ajaa `picker-check`in ja vaatii, että konsoli ja verkko pysyvät puhtaina.
Ajo meni läpi. Tuotantokoodi ei muuttunut, joten selainsarjaa ja Go-tarkistuksia
ei ajettu.
