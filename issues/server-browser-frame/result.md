# Tulokset

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
  siirtyy ⋯-valikkoon. Agentti saa yhä käyttää kirjautumisia, ja Oma selain
  -kortti kertoo agentin käynnin.
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
