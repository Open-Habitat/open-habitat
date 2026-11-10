# Mitä agentti muutti vuorossa

## Kierros 2: Yhteenveto kiinni, aikajana painikkeen takana

Kierros: `design-system/prototypes/rounds/2026-11-10-vuoron-muutokset-2/`
(`NOTES.md` kertoo rakenteen ja tarkistuksen). Jari valitsi kierros 1:stä
Yhteenvedon (1). Katselmoinnista (2) otetaan se, että muutokset ovat
oletuksena kiinni, ja Aikajanan (3) tiedostokohtaiset janat ovat
valinnaisen painikkeen takana. Vuorot, tapaukset ja säätimet ovat samat kuin
kierros 1:ssä (*Vuoro*: monta, pieni, kesken; *Teema*, *Liike*, *Kieli*;
1440 ja 390), ja diffit ovat edelleen tuotannon `FileToolCard`.

Kaikissa muunnelmissa on sama kortti. Vastauksen alla on yksi kiinni oleva
rivi *Muutokset · 8 tiedostoa +35 −27*. Rivi avaa kierros 1:n listan:
jokainen tiedosto kerran merkintöineen, ja tiedostorivi avaa sen koko
muutoksen ja *Avaa editorissa · rivi N*. Avatun kortin otsikossa on
*Aikajana*-painike, joka vaihtaa listan tilalle kierros 1:n janat. Merkki
avaa yksittäisen muokkauksen ja *Lopputulos* koko muutoksen. Uudelleen
painettuna näkyy taas lista.

Muunnelmat tehtiin vain avoimista kysymyksistä: mitä kiinni oleva rivi kertoo
ja missä aikajanan painike on. Jokaisen ero näkyy heti avautuvassa
näkymässä, ja sivun yläreunassa on jokaisesta yksi rivi.

1. **Tiivis**: rivillä on vain tiedostojen määrä ja rivimäärät.
   *Aikajana* tulee näkyviin, kun kortin avaa.
2. **Nimet**: rivin alla on lisäksi ensimmäisten tiedostojen nimet vuoron
   järjestyksessä (`korkeus.ts, haku.ts, haku.test.ts, Tasot.tsx +4 muuta`).
   Uusi nimi on vihreä ja poistettu yliviivattu. Aikajana on kuten Tiiviissä.
3. **Aikajana**: rivi on kuten Tiiviissä, mutta *Aikajana*-painike on jo
   kiinni olevalla rivillä, ja se avaa kortin suoraan aikajanaksi.
   Puhelimessa painikkeessa on vain kellon kuva (saavutettava nimi on mukana).

**Suositus: Nimet.** Kiinni oleva rivi on se, minkä ihminen useimmiten
näkee, ja nimet vastaavat kysymykseen "mitä agentti muutti" avaamatta mitään.
Määrä ja rivimäärät kertovat vain, paljonko muuttui. Aikajana kuuluu avatun kortin
sisään: se on harvoin tarvittu toinen näkymä, ja rivillä se toisi jokaisen
vuoron alle painikkeen, jota useimmat eivät käytä. Puhelimessa nimirivi
katkeaa noin kolmen nimen kohdalla, ja *+4 muuta* jää piiloon. Tuotannossa
nimiä näytettäisiin niin monta kuin mahtuu.

Kuvat ovat `evidence/`-kansiossa (`r2-v<n>-<muunnelma>-<tapaus>-<leveys>-<teema>`).
`oletus` (kiinni) ja `auki` (lista auki) on otettu kaikilla leveyksillä ja
teemoilla. Kun leveys 1440 on vaalea, mukana ovat myös `pieni`, `kesken`,
`oletus-en` (kaikki muunnelmat), `binaari`, `editori`, `aikajana` ja `komento` (Tiivis)
sekä `aikajana` ja `kesken-auki` (Aikajana). Puhelimen 390 vaalealta on
`tiedosto` (Tiivis, avattu diffi) ja `aikajana` (Aikajana).

### Host-tiedot kierros 2:lle

Kierros 1:n kysymys lähteestä on yhä auki (kysymys 2 alla), ja suositus
pysyy: daemon laskee vuoron muutoksen *Palaa tähän* -tarkistuspisteestä ja
gitistä (b), ja toteutus voi alkaa työkalukutsuista (a) samalla
esityksellä. Yhdistelmä tarvitsee lähteeltä seuraavat asiat:

- **Kiinni oleva rivi** tarvitsee vain tiedostojen määrän, nimet ja
  rivimäärät. Tämä on pieni yhteenveto, joka on luettava jokaisen vuoron
  kohdalla, koska rivi näkyy aina. (a):lla rivimäärät ovat korttien summa, ja
  komentojen poistamat ja tekemät tiedostot puuttuvat rivistä kokonaan.
  Tämä näkyy kiinni olevassa rivissä heti: *6 tiedostoa* eikä *8*.
- **Diffin teksti** tarvitaan vasta, kun tiedostorivi avataan. Koska kortti on
  oletuksena kiinni, hostin lukupyyntö voi olla kaksivaiheinen: yhteenveto
  vuorolle ja diffi tiedostolle pyydettäessä. Silloin pitkä historia ei hae
  satojen diffien tekstiä. Kierros 1 ehdotti yhtä pyyntöä, jossa diffi on rajattu.
- **Aikajana** tarvitsee työkalukutsujen hetket, ja ne ovat jo historiassa.
  Komennon tekemän muutoksen hetken saa vain, jos git-tila luetaan jokaisen
  komennon jälkeen eikä pelkästään vuoron alussa ja lopussa. Jos se luetaan
  vain lopussa, neliö voidaan sijoittaa komennon kohdalle vain silloin, kun
  komento nimeää tiedoston (`git rm`). Muuten se jää ilman hetkeä.
  Prototyyppi olettaa, että hetki on tiedossa.

### Päätökset myöhempää arviota varten (kierros 2)

- **Kortti on kiinni myös vuoron ollessa kesken.** Rivillä lukee *tähän
  mennessä*, ja määrä kasvaa. Vaihtoehto olisi auki kesken ja kiinni valmiina,
  mutta liikkuva lista vastauksen alla vie huomion työstä.
- **Avatun listan tiedostorivit alkavat kiinni.** Kierros 1 avasi kolmesti
  muokatun tiedoston demon vuoksi. Kun koko kortti on kiinni, toinen taso
  avoinna olisi ristiriitainen.
- **Yhden tiedoston vuorossa rivi nimeää tiedoston** (*Muutokset ·
  `README.md` +1 −1*) eikä sano *1 tiedosto*. Nimet-muunnelman nimirivi
  jätetään silloin pois, koska nimi on jo rivillä.
- **Nimet ovat vuoron järjestyksessä**, ja niitä on enintään neljä ja
  sitten *+N muuta*. Ne näytetään perusniminä (`haku.ts`) ilman hakemistoa.
  Koko polku on listassa.
- **Aikajana korvaa listan** samassa kortissa (painike `aria-pressed`)
  eikä avaudu listan rinnalle. Kaksi esitystä päällekkäin olisi pitkä, eikä
  puhelimessa ole tilaa rinnakkain.
- **Puhelimessa avattu lista on samassa paikassa keskustelussa** kuin
  työpöydällä, eikä siitä tehty omaa näkymää. Oma näkymä olisi Katselmoinnin
  paneeli, jota Jari ei valinnut. Tunnisteet rivittyvät polun alle, ja
  diffi on koko leveydellä. Kierros 1:n tapaan muunnelmaa ei tehty, koska
  avoin kysymys ei jäänyt.
- **Avoinna oloa ei muisteta.** Kortti on kiinni aina, kun keskustelu
  avataan. Tuotanto voisi muistaa sen selaimessa vuoron mukaan, mutta hostin
  tilaa se ei tarvitse.
- **Aikajanassa ei ole valmiiksi valittua merkkiä** (kierros 1 valitsi
  demon vuoksi).

### Kysymykset Jarille (kierros 2)

1. Mikä muunnelma? Suositus on **Nimet**, ja Aikajana avatun kortin otsikossa.
2. Mistä vuoron muutokset tulevat (kierros 1:n kysymys 2)? (a) Pelkistä
   työkalukutsuista heti ilman hostin muutosta. Kiinni oleva rivi sanoo
   silloin *6 tiedostoa* eikä näe komennon poistamaa tiedostoa tai tekemää
   kuvaa. (b) Daemon laskee muutoksen tarkistuspisteestä ja gitistä.
   Tämä tarvitsee uuden host-rajapinnan, tekee tarkistuspisteistä oletuksen
   ja on arkkitehtuuripäätös. Suositus on (b) kaksivaiheisena (yhteenveto
   vuorolle ja diffi pyydettäessä), ja toteutus voi alkaa (a):lla.
3. Näkyykö kortti myös yhden tiedoston vuorossa (kierros 1:n kysymys 3)?
   Prototyyppi näyttää sen, ja rivi nimeää tiedoston.
4. Pitääkö aikajanan näyttää komennon muutoksen hetki? Jos pitää, daemonin on
   luettava git-tila jokaisen komennon jälkeen. Muuten komennon muutos näkyy
   aikajanalla ilman hetkeä.

## Kierros 1: nykytila ja kolme suuntaa

Kierros: `design-system/prototypes/rounds/2026-11-10-vuoron-muutokset/`
(`NOTES.md` kertoo sivun rakenteen ja tarkistuksen). Sivu on Habitatin oma
kehys ja vuoro tuotannon komponenteista muuttamattomina. Sisältö on keksitty
verkkosovellus `retkiopas`: henkilö pyytää reittihakuun korkeuserot,
vanhan karttakoodin poiston ja laavulle kuvakkeen, ja agentti muuttaa
kahdeksaa tiedostoa kahdessa vaiheessa. Muutetuista tiedostoista yksi on uusi,
yhtä muokataan kolmesti, yksi poistetaan komennolla `git rm`, yksi on komennon tekemä
binäärikuva, ja loput ovat pieniä muokkauksia. Yläpalkin *Vuoro*-valinnalla
saa myös yhden pienen muokkauksen vuoron ja vuoron, joka on vielä kesken.
Kesken oleva vuoro etenee sivun omalla kellolla ja pysähtyy itsestään ennen
loppua; *Jatka* vie sen loppuun. *Teema*, *Liike* ja *Kieli* vaihtavat
vaalean ja tumman, vähennetyn liikkeen sekä suomen ja englannin.

Akseli: **missä ja missä muodossa vuoron muutokset näkyvät yhtenä
kokonaisuutena.** Sivun yläreunassa on jokaisesta suunnasta yksi rivi, ja
jokaisen suunnan ero näkyy heti avautuvassa näkymässä.

0. **Nyt**: kuten tänään. Jokaisen muokkauksen diffi on oman työkalukorttinsa sisällä, ja valmis vaihe taittaa kortit kiinni (*1 ajatus · 6 työkalua*). Kokonaiskuvaa ei ole: kahdeksan tiedoston muutokset pitää koota kymmenestä kortista kahdessa vaiheessa, eikä komennon poistama tai tekemä tiedosto näy missään tiedostona.
1. **Yhteenveto**: vastauksen alla on *Muutokset · 8 tiedostoa +35 −27*. Siinä on jokainen muuttunut tiedosto kerran, rivimäärät ja merkinnät *uusi*, *poistettu*, *binääri*, *komennolla* ja *3 muokkausta*. Rivi avaa tiedoston koko muutoksen vuoron alusta loppuun, ja *Avaa editorissa · rivi N* vie ensimmäiseen muuttuneeseen riviin.
2. **Katselmointi**: keskustelun vieressä on paneeli kuin pull requestissa. Ylhäällä on tiedostolista ja alla yksi tiedosto kerrallaan nuolilla *Edellinen* ja *Seuraava* (*2 / 8*). Vastauksen alla *Katso muutokset (8)* avaa paneelin uudelleen. Puhelimessa paneeli on oma näkymänsä, josta *Keskusteluun* palaa.
3. **Aikajana**: vastauksen alla jokaisella tiedostolla on oma janansa vuoron kellolla, ja vaiheet ja väliviestin hetki näkyvät janan yllä. Ympyrä on Pi:n muokkaus, ja neliö on komennon jälkeen havaittu muutos. Merkki avaa juuri sen muokkauksen sellaisena kuin työkalukortti sen näytti (*Muutos 2/3 · 0:36 · edit*), ja *Lopputulos* näyttää koko muutoksen.

**Suositus: Yhteenveto.** Se vastaa kysymykseen "mitä agentti muutti"
yhdellä silmäyksellä siinä paikassa, jossa ihminen jo lukee vastausta. Se
toimii samana puhelimessa ja vie vähiten uutta pintaa. Katselmointi sopii
isoon muutokseen, jonka joku oikeasti tarkastaa rivi riviltä. Se vie kolmanneksen
näytöstä, ja puhelimessa se peittää keskustelun. Aikajana kertoo eniten
siitä, miten muutos syntyi, mutta sen lukeminen vaatii selittämistä, eikä
useimmilla tiedostoilla ole kuin yksi merkki.

Kuvat ovat `evidence/`-kansiossa (`r1-d<n>-<suunta>-<tapaus>-<leveys>-<teema>`):
`oletus` kaikilla leveyksillä ja teemoilla. Tapaukset `pieni`, `kesken`,
`oletus-en`, `binaari` ja `editori` (Yhteenveto), `poistettu`
(Katselmointi) ja `komento` (Aikajana) ovat 1440 vaaleana.

### Sama kaikissa suunnissa

- Tuotannon vuoro on koskematon. Suunnat lisäävät sen perään tai viereen
  yhden asian, eivätkä työkalukortit muutu.
- Diffit piirtää tuotannon `FileToolCard`. Yksittäinen muokkaus näkyy samana
  kuin työkalukortissa. Tiedoston koko muutos on vuoron alun ja lopun ero
  samalla rividiffillä, ja eri kohtien välissä on hiljainen *⋯*.
- Komennon muuttama tiedosto saa merkinnän *komennolla*. Avattuna se nimeää
  komennon (`git rm src/vanha/kartta-legacy.ts`) ja kertoo, ettei mikään
  työkalukortti näytä sitä. Poistetusta tiedostosta näkyvät sen rivit
  poistettuina. Binääritiedostosta kerrotaan koko, mutta tekstieroa ei näytetä.
- Kesken olevassa vuorossa lista on *tähän mennessä*, ja se kasvaa tiedosto
  kerrallaan. Rivi sanoo, että agentti työskentelee vielä.
- *Avaa editorissa* avaa tiedoston ensimmäisestä muuttuneesta rivistä.
  Prototyypissä ilmoitus kertoo, mitä editori avasi. Puhelimessa painiketta
  ei ole, koska tuotanto ei tarjoa editoria alle 800 px:n leveydellä.

### Host-tiedot

**Mitä daemon ja sopimus kantavat nyt**

- **Työkalukutsut.** Natiivihistoriassa on jokaisen `edit`-kutsun polku ja
  korvaukset (`oldText`/`newText`) sekä `write`-kutsun polku ja koko sisältö.
  Monen Pi-version edit-tulos sisältää myös valmiin unified diffin, jota
  `FileToolCard` käyttää ensisijaisesti. Selain laskee jo nyt jokaiselle
  kortille *+5 −2* (`fileStat`). Elävissä `tool.*`-tapahtumissa `arguments`
  on rajattu 4 096 merkkiin. Sopimuksessa on tapahtumalle myös kenttä
  `structured_diff`, mutta mikään ei täytä sitä.
- **Git.** `workspace-git` antaa työtilasta tiedostokohtaisen tilan ja
  rivimäärät HEADia vasten (`git diff --numstat`, enintään 200 tiedostoa),
  mutta ei diffin tekstiä. Se kuvaa työpuuta nyt, ei vuoroa.
- **Palaa tähän -tarkistuspisteet (kokeellinen).** Daemonin oma Pi-laajennus
  (`rewind-extension.mjs`) tekee yhden tarkistuspisteen jokaista henkilön
  viestiä kohden. Siihen se kopioi jokaisen tiedoston, jota `edit` tai `write`
  koskee, ennen ensimmäistä muutosta. Kopio on siis täsmälleen tiedosto vuoron
  alussa, natiivisti Pi:n istunnossa. Esikatselu (`GET …/rewind?entry=`)
  vertaa sitä tiedostoon nyt. Tiedostoista se kertoo, onko tiedosto luotu,
  muokattu vai poistettu, sekä rivimäärät ja tiedon siitä, onko muutos
  commitoitu (enintään 50). Komennoista se kertoo vain nimet, koska ne jäävät
  kopioinnin ulkopuolelle. Ominaisuus on kokeellisten asetusten takana.
- **Editori.** `POST /api/v1/editor/open` avaa työtilan tiedoston annetusta
  rivistä käynnissä olevassa editorissa. Keskustelun tiedostolinkit käyttävät
  sitä jo, mutta vain työpöydällä.

**Työkalukutsut vai git**

- *Pelkät työkalukutsut* toimivat ilman hostin muutosta: selain ryhmittelee
  vuoron `edit`- ja `write`-kutsut polun mukaan. Komentojen tekemät
  muutokset jäävät kuitenkin pois, kuten tämän kierroksen poistettu
  tiedosto, binäärikuva ja generoidut tiedostot. Tiedoston koko muutosta ei
  myöskään saa tarkasti, koska korvauksista ei tiedä rivinumeroita eikä
  tiedostoa vuoron alussa. Rivimäärät ovat korttien summa, ja kolmesti
  muokatun tiedoston summa on eri kuin sen todellinen nettomuutos.
- *Pelkkä git* näkee myös komentojen muutokset, mutta ei rajaa vuoroa. Siinä
  näkyvät henkilön omat ja toisten keskustelujen muutokset samassa
  työtilassa sekä työpuun aiempi likaisuus. Vuoron aikana tehty commit
  piilottaa muutoksen, ellei vertailukohtana ole vuoron alun HEAD. Työtila,
  joka ei ole git-repo, ei saa mitään.
- *Tuotanto tarvitsisi* daemonilta vuoron muutokset yhdellä lukupyynnöllä.
  Vuoron alun tiedosto tulee tarkistuspisteen kopiosta ja vuoron lopun
  tiedosto seuraavasta tarkistuspisteestä tai levyltä. Komentojen muutokset
  tulevat gitin tilasta, joka luetaan vuoron alussa ja lopussa. Vastauksessa
  olisivat tiedostot, muutoksen laji, rivimäärät, mistä muutos tuli
  (työkalu vai komento) ja diffin teksti rajattuna. Tämä on uusi
  host-rajapinta ja daemonin luku natiivista tarkistuspisteestä, joten se
  on arkkitehtuuripäätös (kysymys 2). Rekisteriä se ei vaadi: kopiot ovat jo
  Pi:n istunnossa, ja git on työtilan oma.
- Aikajanan yksittäiset muokkaukset ovat aina työkalukutsuja. Ne ovat jo
  historiassa, eikä niitä varten tarvita hostin muutosta.

### Päätökset myöhempää arviota varten

- **Järjestys on vuoron järjestys** (ensimmäinen muutos ensin) eikä
  aakkosjärjestys. Aakkosjärjestys on pull requestin tapa, mutta vuoron
  järjestys vastaa vastauksen kertomusta.
- **Oletuksena näkyy tiedoston koko muutos vuoron alusta loppuun**, ei
  muokkaus kerrallaan. Yksittäiset muokkaukset ovat jo työkalukorteissa, ja
  Aikajana tarjoaa ne erikseen.
- **Komennon muutos merkitään ja komento nimetään**, eikä sitä esitetä
  agentin muokkauksena. Vaihtoehto on jättää komentojen muutokset pois
  (Pelkät työkalukutsut). Valitsin merkinnän, koska poistettu tiedosto
  tai generoitu kuva on muutos, jonka ihminen haluaa tietää. Merkintä
  kertoo myös, mistä tieto tuli.
- **Binääritiedostosta näytetään koko**, ei pikkukuvaa. Pikkukuva olisi
  hyödyllinen kuville, mutta se vaatisi tiedoston tavujen hakemista.
- **Poistetun tiedoston rivit näytetään poistettuina**, ja siitä puuttuu
  *Avaa editorissa*, koska tiedostoa ei ole.
- **Editori avautuu ensimmäisestä muuttuneesta rivistä**, eikä
  *Avaa editorissa* -painiketta ole puhelimessa, kuten tuotannon
  tiedostolinkeissä.
- **Luetut tiedostot eivät näy.** Lista kertoo vain muutokset; `read` on
  edelleen työkalukortissa.
- **Yhteenveto avaa kolmesti muokatun tiedoston valmiiksi**, jotta demo
  näyttää diffin heti. Tuotannossa rivit voisivat alkaa kiinni.
- **Katselmointi on oletuksena auki** ja alkaa eniten muokatusta
  tiedostosta. Tuotannossa paneeli voisi aueta vasta painikkeesta.
- **Kesken olevan vuoron aikajana** on mitoitettu kuluneeseen aikaan, johon
  on lisätty 15 % tilaa, koska vuoron loppua ei tiedetä.

### Kysymykset Jarille (kierros 1)

Jari vastasi kysymykseen 1 10.11.2026 (ks. issuen Decisions). Kysymykset 2
ja 3 jatkuvat kierroksessa 2.


1. Mikä kolmesta? Suositus on **Yhteenveto**. Katselmointi voisi myöhemmin
   olla saman listan *Katso kaikki* -näkymä isolle muutokselle.
2. Mistä vuoron muutokset tulevat? (a) Pelkistä työkalukutsuista heti ilman
   hostin muutosta. Silloin komentojen poistamat ja tekemät tiedostot puuttuvat,
   ja rivimäärät ovat korttien summa. (b) Daemon laskee vuoron muutoksen
   Palaa tähän -tarkistuspisteestä ja gitistä. Tulos on tarkka, mutta se tarvitsee uuden
   host-rajapinnan ja tekee tarkistuspisteistä oletuksen (ne ovat nyt
   kokeellisia). Suositus on (b), ja toteutus alkaa (a):lla samalla
   esityksellä.
3. Näkyykö yhteenveto myös vuorossa, joka muutti vain yhtä tiedostoa
   (`pieni`)? Silloin se toistaa työkalukortin, mutta paikka pysyy samana.

## Ympäristö ja näyttö

Kierros 2 on rakennettu tuotannon komponenteista tämän worktreen puusta
(pohja `81c60ba6d`): Playwright Chromium headless, 1440 × 900 ja 390 × 844
(kosketus), DPR 2, vaalea ja tumma, vähennetty liike. `check.mjs` teki
252 tarkistusta, ja konsoli oli puhdas. Kierros 1 oli rakennettu pohjasta `77618d656`, ja sen
`check.mjs` teki 192 tarkistusta.

Itsenäiset staattiset sivut (HTML, fontit ja koodi upotettuina, ei verkkoa)
ovat `design-system/prototypes/dist/vuoron-muutokset-2/offline.html` ja
`design-system/prototypes/dist/vuoron-muutokset/offline.html`. `dist/` ei ole
versionhallinnassa, joten sivut rakennetaan näin:

```
node design-system/prototypes/rounds/2026-11-10-vuoron-muutokset-2/build.mjs
open-habitat agent view offer --current --source design-system/prototypes/dist/vuoron-muutokset-2/offline.html --title "Vuoron muutokset · kierros 2" --idempotency-key 108bb851-9b4e-4952-a755-ef85fe3b238b --json
node design-system/prototypes/rounds/2026-11-10-vuoron-muutokset/build.mjs
open-habitat agent view offer --current --source design-system/prototypes/dist/vuoron-muutokset/offline.html --title "Vuoron muutokset · kierros 1" --idempotency-key b9f62088-9bd1-4178-8de7-2c37f269792e --json
```
