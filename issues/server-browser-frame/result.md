# Tulokset

### Jarin vastaukset kierrokseen 2 (28.11.2026)

- Kierros 2 on hyvä.
- Kioskitila: **sopii** (ponnahdusikkunat koko näytön kokoisiksi).
- **Avaa osoite… tarvitaan.** Lisäksi selaimen historian selaaminen ja
  mahdollisesti kirjanmerkit. Prototyypataan (kierros 3) ennen toteutusta.
- Toteutus vasta, kun osoitteen kirjoittaminen, historia ja kirjanmerkit on
  prototyypattu.

## Kierros 2

Prototyyppi: `design-system/prototypes/rounds/2026-11-27-palvelinselain-kehys-2/`
(`NOTES.md`), tulos
`design-system/prototypes/dist/2026-11-27-palvelinselain-kehys-2/offline.html`.
Valitsimessa **1 Paneeli** ja **Nykyinen** (tuotannon arkki saman sivun
ympärillä). Tarkistettu 1440 × 900, 1440 × 780 ja 390 px, Päivä ja Yö.

### Päätökset (Jari 27.11.)

Paneeli; etänäyttö pysyy kiinteänä 1280 × 800; Chromen välilehtirivi pois
kuvasta; `<` / `>` pois; ⋯-valikosta pois *Liitä pitkä teksti…*,
*Kirjoita sivulle…* ja *Kopioi valinta koneellesi*; *Sulje välilehti*;
Valmis ennallaan.

### Mitä muuttui

- **Kuvassa on vain sivu.** Chromen välilehti- ja osoiterivi eivät näy,
  joten sivu saa koko 800 px korkeuden (ks. löydös alla). Aktiivinen
  välilehti näyttää palkissa originin (`tunnistus.example`), koska Chromen
  osoiteriviä ei enää ole. Kirjautumissivulla näkyy näin yhä, kenelle
  tunnukset annetaan.
- **Ei `<` / `>`.** Klikkaus kuvaan ottaa ohjauksen ja levittää paneelin.
  Tuotannon *Keskustelu*-reuna kaventaa sen keskustelun viereen.
- **⋯-valikko:** *Ota ohjaus* (tai *Anna agentille ja jatka katsomista*),
  *Leikkaa*, *Kopioi* ja *Liitä*, joiden pikanäppäimet näkyvät (⌘X/⌘C/⌘V,
  muilla Ctrl), sekä *Sulje välilehti*, *Sulje selain* ja lause siitä,
  mitä agentti saa käyttää. Leikkaa, Kopioi ja Liitä toimivat kuten
  näppäimet kuvassa. Kun agentti odottaa, ne ottavat ensin ohjauksen, ja
  kun agentti on kesken, ne kysyvät ensin.
- **Puhelin:** palkissa on näppäimistöpainike silloin, kun ohjaat. Se
  kohdistaa näkymättömän kentän, joten puhelimen oma näppäimistö aukeaa, ja
  jokainen merkki menee sivulle näppäilynä kuten työpöydällä. Kuvassa lukee
  *Kirjoitus menee sivulle*. Näin siksi, että etäkuva ei ole tekstikenttä
  eikä voi itse avata näppäimistöä. Erillinen tekstidialogi olisi ylimääräinen
  askel, ja tällä tavalla salasanakin näkyy vain sivun omana peitettynä
  kenttänä. noVNC:n oma käyttöliittymä tekee saman. Näppäimistön liittäminen
  menee samaa reittiä kuin ⌘V.
- **Nykyinen** on valitsimen toinen kohta, ja sen kuvaan on piirretty
  Chromen välilehti- ja osoiterivi. Sivulle jäävä korkeus näytöllä:

  | Ikkuna | Paneeli | Nykyinen |
  | --- | --- | --- |
  | 1440 × 900 | 686 px | 634 px |
  | 1440 × 780 (läppäri) | 686 px | 538 px |
  | 1280 × 720 | 586 px | 484 px |
  | 390 × 844 | 241 px | 207 px |

### Löydös: miksi Chromen välilehdet näkyvät ja mikä ne piilottaa

- Host käynnistää Chromen tavallisena ikkunana
  (`internal/browserhost/host_linux.go`, `chromeArgs`:
  `--window-position=0,0`, `--window-size`). Koko 1280 × 800 tulee
  `internal/cli/browser_linux.go`:sta. Tavallisessa ikkunassa välilehti- ja
  osoiterivi vievät 88 px, ja sivulle jää 1280 × 712. Mittasin tämän Chromella
  Xvfb:ssä.
- **`--kiosk` piilottaa molemmat.** Sivu on silloin 1280 × 799 (+12 %
  korkeutta samassa kuvassa). Uusi välilehti (`target=_blank`, CDP
  `Target.createTarget`) avautuu samaan ikkunaan, joten Habitatin palkki on
  ainoa välilehtinäkymä. Tämäkin on mitattu.
- **Ponnahdusikkuna on yhä oma ikkunansa**, ja sillä on kioskitilassakin
  oma vain luku -osoiterivi (36 px). Host sovittaa ponnahdusikkunan jo nyt
  näyttöön (`activateWindow`: `windowState: "normal"` ja näytön rajat). Kun
  tilalle laitetaan `windowState: "fullscreen"`, osoiterivi katoaa ja
  ponnahdusikkuna täyttää kuvan kuten välilehti. Kokeilin tämän. Hostin
  pitää tehdä sama myös uudelle ponnahdusikkunalle sen auetessa.
- **Seuraukset:** osoitetta ei näe eikä voi kirjoittaa kuvassa, joten
  origin näkyy Habitatin palkissa. Chromen takaisin- ja päivityspainikkeet
  katoavat. Chromen omat kuplat (salasanan tallennus, lupakysymykset,
  latauskupla) on ankkuroitu työkaluriviin, ja niiden käytös kioskitilassa
  pitää katsoa labissa ennen toteutusta, samoin Alt+← ja F5 näppäiminä.
  Muutos on hostin käynnistysvalitsin ja yksi CDP-kutsu. Valtuuksia ei siirry.

### Päätökset myöhempää katselmointia varten

- **Leikepöydän turvaominaisuudet:** etäleikepöytä tyhjennetään yhä
  palautuksessa, ja sitä käytetään vain painalluksesta (kieltäytymisen
  painike), ei varareittinä. Poistettu pitkän liitteen dialogi kantoi
  lauseen, ettei teksti ole agentilta piilossa. Se siirtyi leikepöydän
  kautta liittämisen kuittaukseen (*Agentti näkee leikepöydän, kunnes annat
  selaimen takaisin*). *Kopioi valinta koneellesi* korvautui Kopioi- ja
  Leikkaa-toiminnoilla sekä ⌘C:llä ja ⌘X:llä. Etäkopio tulee koneellesi yhä
  vain omasta painalluksestasi silloin, kun ohjaat, eikä agentin kopio
  koskaan. Tätä varten hostin pitää lukea etäleikepöytä kopiointinäppäimen
  jälkeen. ⋯ *Liitä* lukee oman leikepöytäsi, ja selain kysyy siihen luvan
  ensimmäisellä kerralla. ⌘V ei tarvitse lupaa.
- Viimeistä välilehteä ei suljeta, kuten kierroksessa 1. Tuotannon host
  korvaa sen tyhjällä välilehdellä ja sulkee sitten. Toteutus seuraa
  hostia, ellei toisin päätetä.
- Muut kierroksen 1 päätökset pysyvät: näkymän sulkeminen silloin, kun
  ohjaat, antaa selaimen takaisin, eikä Ota ohjaus -painiketta ole.

### Kysymykset Jarille

1. Saako host ajaa Chromea kioskitilassa ja tehdä ponnahdusikkunoista koko
   näytön kokoisia? Silloin osoiterivi ja Chromen takaisin-painike katoavat
   kuvasta, ja palkki näyttää originin.
2. Riittääkö, että sivut avaa agentti, vai tarvitaanko ⋯-valikkoon
   *Avaa osoite…*, koska osoiteriviä ei enää voi kirjoittaa?

### Jarin vastaukset kierrokseen 1 (27.11.2026)

- **Paneeli** on paras.
- Etänäytön koko pysyy kuten nyt; Jari: "En usko, että sitä tarvitaan" (ei koon seurantaa). Alkuperäinen lause: "tila,
  jossa tämä aina on, on se ikkuna joka on jo nyt": ei koon seurantaa).
- Kun välilehdet ovat Habitatin palkissa, ne eivät saa näkyä myös etäkuvassa
  (Chromen oma välilehtirivi pois kuvasta).
- `<` / `>` -painikkeet pois.
- ⋯ on hyvä, mutta *Liitä pitkä teksti…*, *Kirjoita sivulle…* ja *Kopioi
  valinta* pois. Valikossa voi olla *Leikkaa* ja *Liitä* pikanäppäimineen.
  Pitkän tekstin liittäminen hoituu ⌘V:llä.
- *Sulje tämä välilehti* → *Sulje välilehti*.
- **Valmis**-painike on erityisen hyvä: juuri tällaista suoraviivaisuutta.
- Näkymän sulkeminen silloin, kun ohjaat, antaa selaimen agentille: **kyllä**.

## Kierros 1

Prototyyppi: `design-system/prototypes/rounds/2026-11-27-palvelinselain-kehys-1/`
(tilat, rakennus ja tarkistus sen `NOTES.md`:ssä), tulos
`design-system/prototypes/dist/2026-11-27-palvelinselain-kehys-1/offline.html`.
1440 ja 390 px, Päivä ja Yö.

### Jarin palaute (27.11.)

1. Liian monta askelta: *Ota ohjaus*, *Valmis*, *Sulje selain*. Välilehteä ei
   voi sulkea.
2. *Leikepöytä*-valikko on turha, koska ⌘/Ctrl+V liittää jo ilman sitä.
3. Kuva on pieni.

### Kevyempi kehys (sama kaikissa suunnissa)

- **Ota ohjaus -painike pois.** Klikkaus tai näppäin kuvassa ottaa
  ohjauksen, kuten tuotannossa jo nyt. Näppäimistön käyttäjälle sama on
  ⋯-valikossa.
- **Yksi lopetus.** Kun ohjaat, **Valmis** antaa selaimen agentille,
  tyhjentää etäkoneen leikepöydän ja sulkee näkymän. Kun agentti ohjaa, ×
  vain sulkee näkymän. *Anna agentille ja jatka katsomista* on ⋯-valikossa.
  *Sulje selain* siirtyi ⋯-valikkoon.
- **Välilehdet näkyvät välilehtinä.** Edessä oleva on korostettu, ja sen ×
  näkyy aina. Ponnahdusikkuna on oma välilehtensä, jossa on merkki
  *ponnahdus*. Puhelimessa ja pillerissä välilehdet ovat valikossa, jossa on
  myös *Sulje tämä välilehti*. ⌘W ei voi toimia, koska oma selain sulkisi
  Habitatin välilehden ennen kuin sivu saa painalluksen.
- **Leikepöytä-painike pois.** ⌘/Ctrl+V kirjoittaa tekstin näppäilyinä
  kuten nyt. Jos tekstissä on rivinvaihto tai yli 1 000 merkkiä, kuittauksessa
  on painike *Liitä leikepöydän kautta*. ⋯-valikossa ovat *Liitä pitkä
  teksti…*, *Kirjoita sivulle…* (puhelimessa myös palkin avainpainike, koska
  kuva ei avaa näppäimistöä), *Kopioi valinta koneellesi* ja lause *Agentti
  saa käyttää kaikkea, mihin tämä selain on kirjautunut*.
- **Vuoro näkyy kahdesta paikasta:** reunasta (tuotannon katkoviiva =
  agentti, yhtenäinen = sinä) ja palkin sirusta. Agentin pyyntö näkyy palkin
  alla, kunnes otat ohjauksen. Tuotannon kesken-kysymys ja *Ota, kun se on
  valmis* ovat ennallaan.

### Suunnat: missä selain asuu ja miten ohjaimet ovat sen päällä

1. **Paneeli:** selain on tuotannon oikeassa paneelissa (`ViewSplit`), ja
   sen yläreunassa on ohut palkki. Kun ohjaat, paneeli on leveä, ja
   keskustelu on yhden painalluksen päässä. Sivupalkki vie kuitenkin tilaa,
   joten kuva on suunnilleen nykyisen kokoinen.
2. **Ikkuna (suositus):** selain täyttää ikkunan, ja palkki on sama.
3. **Pilleri:** kuva täyttää ikkunan, ja ohjaimet kelluvat sen päällä
   pillerissä. Pilleri peittää sivun yläreunaa, vaikka sen voi siirtää
   alas.

Suositus on 2 Ikkuna. Se antaa suurimman kuvan niin, ettei mikään peitä
sivua. Palkki ja käytös ovat samat kuin Paneelissa, joten paikan voi vaihtaa
myöhemmin ilman uutta kehystä.

### Miksi kuva on pieni

- **Etänäyttö on kiinteä 1280 × 800.** `internal/cli/browser_linux.go`
  antaa koon. Host käynnistää Xvnc:n tällä `-geometry`-koolla ja Chromen
  samalla `--window-size`-koolla. Katselin (`BrowserViewer.tsx`) käyttää
  noVNC:n asetuksia `scaleViewport = true`, joka skaalaa kuvan isommaksi tai
  pienemmäksi laatikkoonsa sopivaksi, ja `resizeSession = false`.
- **Kuva on siis niin iso kuin sille jäävä laatikko.** Nykyinen arkki on
  enintään 1180 × 860 px. Siitä vievät tilaa otsikkorivi, ikkunarivi,
  totuusrivi, välit ja kehys. Mitattu kuvan leveys ja osuus 1280 × 800:sta:

  | Ikkuna | Nykyinen | 1 Paneeli | 2 Ikkuna | 3 Pilleri |
  | --- | --- | --- | --- | --- |
  | 1440 × 900 | 1139 px · 89 % | 1097 · 86 % | 1360 · 106 % | 1430 · 112 % |
  | 1440 × 780 (läppäri) | 966 · 75 % | 1097 · 86 % | 1168 · 91 % | 1238 · 97 % |
  | 1280 × 720 | 870 · 68 % | 937 · 73 % | 1072 · 84 % | 1142 · 89 % |
  | 390 × 844 (puhelin) | 372 · 29 % | 386 · 30 % | 386 · 30 % | 384 · 30 % |

- **Voisiko näyttö seurata näkymän kokoa?** Teknisesti kyllä. TigerVNC:n
  Xvnc hyväksyy koon muutoksen asiakkaalta (`AcceptSetDesktopSize`, oletus
  päällä; tarkistettu `Xvnc -help`), ja noVNC pyytää sitä, kun
  `resizeSession = true`. Chrome-ikkuna ei kuitenkaan seuraa itsestään,
  koska ikkunanhallintaa ei ole. Hostin pitäisi asettaa ikkunan rajat CDP:llä,
  samaan tapaan kuin välilehden valinta jo nyt sovittaa ikkunan näytön
  rajoihin. Hinta: näyttö on yksi ja yhteinen, joten sivun asettelu muuttuu
  agentin alla (taitekohdat, osoittimen paikka, kuvakaappaukset).
  Prototyypin valinta *Näyttö seuraa kokoa* näyttää ehdotuksen: kun sinä
  ohjaat, sivu piirtyy näkymän kokoiseksi 1:1, ja kun annat sen takaisin,
  koko palaa 1280 × 800:aan. Hyöty on suurin puhelimessa, jossa kuva on nyt
  29 % alkuperäisestä eikä tekstiä voi lukea.

### Päätökset myöhempää katselmointia varten

- **Näkymän sulkeminen silloin, kun ohjaat, antaa selaimen takaisin.**
  Tuotannossa arkin sulkeminen tyhjentää etäleikepöydän mutta jättää
  ohjauksen sinulle. Tauon jälkeinen palautus toimii vain, kun katselin on
  auki, joten agentti jää odottamaan, kunnes joku antaa selaimen takaisin.
- **Leikepöydän turvaominaisuudet säilyvät:** etäkoneen leikepöytä
  tyhjennetään palautuksessa, sitä käytetään vain painalluksesta (kuittauksen
  painike tai ⋯) eikä koskaan varareittinä, pitkän liitteen dialogi sanoo,
  ettei teksti ole agentilta piilossa, ja etäkopio tulee koneellesi vain
  pyydetystä kopioinnista.
- **Ehdotan pudotettavaksi** erillisen *Salasana näppäilyinä* -kentän.
  ⌘V kirjoittaa salasanankin jo näppäilyinä ilman leikepöytää, ja puhelimen
  *Kirjoita sivulle* -kenttä on oletuksena piilotettu. Pysyvä totuusrivi
  siirtyy ⋯-valikkoon. Agentti saa yhä käyttää kirjautumisia, ja keskustelun
  Selain-kortti kertoo agentin käynnin.
- Välilehden valinta tai sulkeminen ottaa ohjauksen kuten nyt, koska se
  muuttaa agentin maailmaa. Viimeistä välilehteä ei suljeta. Escape ei sulje
  näkymää silloin, kun ohjaat, vaan menee sivulle.
- **Host-tieto:** status ei kerro, mikä välilehti on edessä (`windows`:
  `id`, `title`, `origin`, `agent`). Korostus ja *Sulje tämä välilehti*
  tarvitsevat `active`-kentän sopimukseen, tai näkymän pitää muistaa
  viimeksi valitsemansa välilehti.

### Kysymykset Jarille

1. Ikkuna vai Paneeli? Paneelissa keskustelu on vieressä, mutta läppärillä
   kuva on noin 6 % pienempi kuin Ikkunassa.
2. Saako näyttö seurata näkymän kokoa silloin, kun ohjaat? Tämä on
   host-muutos, ja agentin sivun asettelu vaihtuu siksi aikaa.
3. Saako näkymän sulkeminen silloin, kun ohjaat, antaa selaimen agentille,
   vai pitäisikö ohjauksen jäädä sinulle?
