# Microsoft 365 usealle organisaatiolle: prototyyppikierrokset

## Kierros 4

Kierros: `design-system/prototypes/rounds/2026-11-27-entra-organisaatiot-4/`
(`NOTES.md` kertoo URL-parametrit ja komennot). Sivu:
`design-system/prototypes/dist/2026-11-27-entra-organisaatiot-4/offline.html`,
tehdään uudelleen komennolla
`node design-system/prototypes/rounds/2026-11-27-entra-organisaatiot-4/build.mjs`.

### Jarin päätökset kierroksesta 3 (27.11.2026)

- A2a valittiin. A2b poistuu valitsimesta, Nyt jää vertailuun.
- Rivin tasorivi (*4/4 tasoa asetettu: Täysi · …*) siirtyy Tasot-painikkeeseen
  lukuna samalla tavalla kuin *Organisaatiot 3*. Rivillä on vain kaksi
  painiketta.
- Viimeistelyveto: kaikki välit tarkistetaan tokeneita vasten.

### Mitä muuttui

- Valitsimessa ovat **Nyt** ja **A2a**.
- Microsoft-rivillä on nimi, *Käyttöönotossa*, tila ja kaksi painiketta:
  *Organisaatiot 3* ja *Tasot 4/4*. Luku on molemmissa sama pilleri.
  Organisaatioiden ikoni poistui, jotta painikkeet ovat samanlaiset.
- Tasorivi on poissa rivistä. Asetettujen tasojen nimet ovat Tasot-ikkunassa
  kuten ennenkin sekä painikkeen saavutettavassa nimessä ja vihjeessä
  (*Tasot, 4/4 tasoa asetettu: Täysi, Ei lähetystä, Luonnokset, Vain luku*).
  Organisaatiot-painikkeen nimi ja vihje luettelevat organisaatiot samoin.
- Uusi tilanne **Näytä › Tasot 2/4**: tilasarake näyttää tuotannon
  *2/4 tasoa tarjolla* (varoitus), painike on *Tasot 2/4* toissijaisena
  (huomiota vaativa), ja sen nimi päättyy *Aseta puuttuvat*. Rivillä luku
  ja tila kertovat saman asian kahdesti, mutta tila on sarake, jota luetaan
  ylhäältä alas, ja painike kertoo, mistä puuttuvat asetetaan.
- Tila *Hyväksyntä ei näy palvelimelle* jäi ennalleen: lyhyempi muoto
  (*Hyväksyntä ei tiedossa*) ei kerro, että juuri palvelin ei sitä näe.
  Hyväksyntäviesti ja rajoituksen lause ovat kierroksen 3.

### Välien korjaukset

`check.mjs` mittaa nyt jokaisessa tilassa (rivi, molemmat ikkunat, jokainen
vaihe, Lisätietoja auki, lisäyksen virheet, henkilön näkymät; 1440 ja 390,
vaalea ja tumma, englanti), ettei kahden näkyvän kontrollin laatikoiden väli
ole alle `--ah-control-gap` (6 px) ja että poisto on vähintään `--ah-s4`
(12 px) edellisestä kontrollista. Kierroksen 3 rakennelmassa tarkistus löysi
nämä, ja ne on korjattu:

- **Hyväksyntävaiheen tasolinkit** (*Vain luku*, *Luonnokset*, …) olivat
  4 px toisistaan, puhelimessa rivittyessään 2 px. Nyt `--ah-control-gap`.
  Tämä on todennäköisin kohta, jonka Jari näki.
- **Tasot-ikkunan Poista-painikkeet** (tuotanto, `.ml-known`) olivat
  päällekkäin 2 px:n välein. Nyt `--ah-control-gap`.
- **Google-rivin *Käyttöönotossa*-linkki ja *Mitä tasot sallivat*** (tuotanto,
  `.ah-people-person`) olivat 2 px toisistaan. Nyt `--ah-control-gap`.
- **Rivin painikkeet rivittyessään** (tuotanto, `.ah-people-end`) saivat
  pystyväliksi 4 px. Nyt `--ah-control-gap`.
- **Poiston vahvistus** on vähintään `--ah-s4` Peruuta-painikkeesta (oli 6 px).
- **Organisaatioiden rivit** ovat yhtä korkeat (Oma-merkki teki ensimmäisestä
  korkeamman), toiminnot tasattu rivin loppuun.
- **Puhelimessa** rivin toiminnot ovat nimen ja tilan alla, joten nimi ei
  enää rivity kahden painikkeen vieressä.
- **Lisäysvaiheen kentät** ovat ikkunan levyiset, joten GUID mahtuu riville.

Tuotannon osien korjaukset ovat kierroksessa vain A2a:lle; Nyt näyttää
tuotannon sellaisenaan. Toteutus vie ne tuotannon CSS:ään.

### Päätökset myöhempään tarkasteluun

- Luku on pilleri (*Tasot 4/4*), ei tekstiä (*Tasot (4/4)*): sama kuin
  kierroksen 3 *Organisaatiot 3*, ja numerot pysyvät tasalevyisinä.
- Kun yhtään tasoa ei ole asetettu, painike on tuotannon *Luo sovellukset…*
  ilman lukua; *0/4* ei kertoisi, mitä tehdä. Tätä tilaa ei ole kierroksessa.
- Ikkunoiden otsikon yläväli (otsikon oma marginaali ja ikkunan reunus) on
  tuotannon kaikille ikkunoille yhteinen, joten sitä ei muutettu.
- Tasot-ikkunan Poista on tuotannossa hiljainen vihreä painike eikä punainen
  ikoni toissijaisella pinnalla, kuten pienten painikkeiden säännöt sanovat.
  Se jätettiin, koska kierros koskee välejä.

### Kysymykset Jarille

1. Riittääkö *Tasot 2/4* ja tilan *2/4 tasoa tarjolla* yhdistelmä
   osittaisessa tilassa, vai pitäisikö painikkeen sanoa tuotannon tapaan
   *Aseta puuttuvat…* luvun sijaan?

### Jarin vastaukset kierrokseen 4 (27.11.2026)

- Hyväksyntäviesti kelpaa sellaisenaan.
- Vajaa tila *Tasot 2/4* + *2/4 tasoa tarjolla* riittää.
- Tilapilleri *Käyttöönotossa* on harhaanjohtava (kuulostaa keskeneräiseltä
  asetukselta); se muutetaan erikseen issuessa
  `integration-state-in-onboarding-label` (*Tarjolla*).

---

## Kierros 3

Kierros: `design-system/prototypes/rounds/2026-11-27-entra-organisaatiot-3/`
(`NOTES.md` kertoo URL-parametrit ja komennot). Sivu:
`design-system/prototypes/dist/2026-11-27-entra-organisaatiot-3/offline.html`,
tehdään uudelleen komennolla
`node design-system/prototypes/rounds/2026-11-27-entra-organisaatiot-3/build.mjs`.

### Jarin päätös kierroksesta 2 (27.11.2026)

A2 valittiin: *Organisaatiot*-painike Tasojen vieressä. Rivin oma *Mitä
tasot sallivat* poistetaan, koska tasot selitetään jo Tasot-painikkeen
takana. Organisaatiot avautuu samalla tavalla kuin Tasot, ja ikkunassa on
selkeät rivit: yksi organisaatio riviä kohti, nimi, *Oma*, hyväksynnän tila
ja sen toiminto, poisto, ja alimpana *Lisää organisaatio*. Tämä on A2:n
iterointi eikä uusi suuntien valinta.

### Mitä muuttui

- Valitsimessa ovat **Nyt**, **A2a** ja **A2b**; A1 ja A3 poistuivat.
- Microsoft-rivillä on Tasot ja sen vieressä *Organisaatiot 3* samalla
  roolilla ja tyylillä. *Mitä tasot sallivat* on poissa Microsoftin
  riviltä (Nyt-suunnassa se on yhä vertailun vuoksi).
- Tuotannon Tasot ei avaudu ponnahdusikkunaan vaan keskitettyyn ikkunaan
  (`MicrosoftLevelsDialog`), joten Organisaatiot avautuu nyt samoin: sama
  overlay ja ikkuna, pysyvä otsikko *Microsoft 365: organisaatiot*, ja
  puhelimessa sama ikkuna kuin Tasoilla. Kierroksen 2 alhaalta nouseva arkki
  jäi pois.
- Rivillä: nimi, *Oma*, tila ja ryhmä *Hyväksyntä* ja punainen roskakori
  (pienten painikkeiden säännöt: poisto viimeisenä ja erillään, ryhmä
  nimetty organisaatiolla).
- **Ikkuna ei enää sulkeudu toiminnon ajaksi.** Hyväksyntä, lisäys ja
  poiston vahvistus ovat saman ikkunan vaiheita: ikkunan sisältö vaihtuu
  vaiheeksi ja palaa Valmis-, Takaisin- tai Peruuta-painikkeella listaan,
  ja fokus palaa riville, jolta vaihe avattiin. Valitsin tämän enkä Tasojen
  tapaa, koska tuotannon Tasotkin sulkee ikkunansa avatessaan poiston eikä
  avaa sitä uudelleen, joten siitä ei saa mallia. Vaiheet ovat Tasojen
  ohjatun asetuksen muoto, ja rivin avaaminen paikalleen olisi tehnyt
  listasta pitkän ja hyväksyntäviestin kanssa vieritettävän.
- Henkilön näkymä on sama kuin kierroksella 2.

### Vaihtoehdot ja suositus

- **A2a:** rivillä ylhäällä nimi ja *Oma*, alla tila pienellä; toiminnot
  rivin lopussa.
- **A2b:** nimi ja *Oma*, tila ja toiminnot sarakkeina yhdellä rivillä;
  puhelimessa sama kuin A2a.

Suositus **A2a**: pitkä nimi saa koko leveyden, tila luetaan nimen osana
eikä omana sarakkeenaan, ja rivi näyttää samalta työpöydällä ja
puhelimessa. A2b on taulukkomaisempi, mutta kolmella tai neljällä rivillä
sarakkeista ei ole hyötyä, ja ikkuna on leveämpi, jotta sarakkeet mahtuvat.

### Päätökset myöhempään tarkasteluun

- Hyväksynnän tila kertoo vain sen, minkä palvelin tietää: omalla
  organisaatiolla *Hyväksytty, kun loit sovellukset*, asiakkailla
  *Hyväksyntä ei näy palvelimelle*. Toiminto on kaikilla *Hyväksyntä*
  (asiakkailla toissijainen painike, omalla hiljainen).
- Ikkuna on 720 px leveä (tuotannon ikkunan oletus). Tasojen 920 px
  on mitoitettu sen vertailutaulukolle, eikä sitä tarvita kolmen rivin
  listalle.
- Kierroksen 2 kysymykset 2 ja 3 jäivät avoimiksi, joten niiden valinnat
  pysyvät: rajoituksen lause näkyy vain lisäysvaiheessa (*Asiakkaan tietoja
  rajaa asiakkaan oma Entra, ei tämä lista.*), ja listan Lisätietoja kertoo,
  miksi lista ei ole tietoturvaraja; hyväksyntäviesti on kierroksen 2
  lyhennetty viesti sellaisenaan.
- Kierroksen 2 muut päätökset ovat edelleen voimassa.

### Kysymykset Jarille

1. A2a vai A2b?
2. Riittääkö hyväksynnän tilaksi rehellinen *Hyväksyntä ei näy
   palvelimelle*? Varmempi tila vaatisi palvelimelle uuden tiedon (kuka on
   yhdistänyt mihinkin organisaatioon), ja se jätettiin v1:stä pois.
3. Kierroksen 2 avoimet: riittääkö rajoitukseksi lisäysvaiheen yksi lause
   ja listan Lisätietoja, ja voiko hyväksyntäviestin lähettää
   sellaisenaan?

---

## Kierros 2

Kierros: `design-system/prototypes/rounds/2026-11-27-entra-organisaatiot-2/`
(`NOTES.md` kertoo URL-parametrit ja komennot). Sivu:
`design-system/prototypes/dist/2026-11-27-entra-organisaatiot-2/offline.html`,
tehdään uudelleen komennolla
`node design-system/prototypes/rounds/2026-11-27-entra-organisaatiot-2/build.mjs`.

Yläpalkissa on nyt kaksi isoa painiketta, **Ylläpitäjä** ja **Henkilö**.
Henkilö avautuu sivulle Asetukset › Tiedot agenteille: Microsoft on
yhdistetty omaan organisaatioon ja vieraana Asiakas Yksi Oy:hyn, ja Asiakas
Kaksi Oy on rivi *Ei yhdistetty · Yhdistä*. Yhdistä vie tuotannon taso- ja
laitekoodivaiheen läpi kortiksi, jossa on vain tiedostot; laitekoodivaiheen
ohjauspalkista saa kieltäytymisen (*Asiakas Kaksi Oy ei ole hyväksynyt
tasoa Vain luku.* ja Kopioi pyyntö). Henkilön näkymä on sama kaikissa
suunnissa. Sivu avautuu Ylläpitäjän puolelle, koska valitsimen suunnat
eroavat vain siellä; Näytä-valikko hyppää suoraan mihin tahansa tilanteeseen.
Näkymä ja tilanne säilyvät, kun suuntaa vaihtaa valitsimesta.

### Suunnat

Akseli: **miten Microsoft-rivin kiinni oleva organisaatiolista avautuu.**
Avattu lista on kaikissa sama: nimi, *Oma*-merkki, Hyväksyntä ja
roskakori, alla Lisää organisaatio ja Lisätietoja.

0. **Nyt**: tuotanto tänään, yksi organisaatio.
1. **A1 Yhteenveto.** Rivillä *3 organisaatiota · Näytä*, kuten tuotannon
   *Mitä tasot sallivat*. Näytä avaa listan rivin alle sisennettynä ja
   työntää muut rivit alemmas. Päättää: lista on osa sivua, ja auki
   jätetty lista pysyy auki toimintojen ajan.
2. **A2 Painike.** Rivin loppuun Tasot-painikkeen viereen tulee
   *Organisaatiot 3*, joka avaa listan ponnahdusikkunaan painikkeen alle
   (puhelimessa alhaalta nouseva arkki, kuten tuotannon Git-tila). Rivillä
   ei ole muuta. Päättää: rivi ei kasva lainkaan, ja organisaatiot ovat
   Tasojen rinnalla Microsoftin toinen asetus.
3. **A3 Sirut.** Rivillä nimet pieninä siruina ja *Hallitse…*, joka avaa
   ikkunan. Päättää: nimet näkyvät aina, mutta toiminnot vain ikkunassa.

### Suositus

**A1.** Se on tuotannossa jo käytetty muoto samalla rivillä (*Mitä tasot
sallivat*), joten uutta mallia ei tule, ja kiinni oleva rivi kasvaa vain
yhden lyhyen rivin. Lista aukeaa paikalleen eikä peitä mitään, joten
hyväksyntäikkunasta palataan samaan näkymään. A2 on siistein kiinni, mutta
ponnahdusikkuna sulkeutuu aina, kun sieltä avaa hyväksynnän tai poiston, ja
puhelimessa se on erillinen arkki. A3:n sirut kasvavat kahdeksi riviksi
jo neljällä pitkällä nimellä, ja ne toistavat listan, jota ylläpitäjä ei
tarvitse joka käynnillä.

### Tekstit ennen ja jälkeen

Sanat suomeksi (`wordcount.mjs`, joka laskee ne molempien kierrosten
`text.ts`:stä; URL on yksi sana). *Näkyvissä* on se, minkä näkee
avaamatta mitään; *avattavissa* on kierroksen 1 *Mitä lista rajoittaa?*;
*Lisätietoja* on se, minkä kierros 2 siirsi yhden Lisätietoja-avauksen
taakse.

| Teksti | Kierros 1 näkyvissä | Kierros 1 avattavissa | Kierros 2 näkyvissä | Kierros 2 Lisätietoja |
| --- | ---: | ---: | ---: | ---: |
| Microsoft-rivi ja organisaatiolista | 20 | 0 | 9 | 12 |
| Lisäysikkuna | 43 | 0 | 11 | 10 |
| Hyväksyntäpaneeli (ilman viestiä) | 120 | 0 | 20 | 22 |
| Rajoitus | 14 | 87 | 9 | 47 |
| Poiston vahvistus | 78 | 0 | 16 | 22 |
| Viesti asiakkaan pääkäyttäjälle | 199 | 0 | 79 | 0 |
| Henkilö: rivit, yhdistäminen, vierastilin kortti | 70 | 0 | 23 | 0 |
| Kieltäytyminen: ei hyväksyntää | 46 | 0 | 18 | 0 |
| Kieltäytyminen: pyyntö pääkäyttäjälle | 37 | 0 | 14 | 0 |
| Kieltäytyminen: not_in_organisation | 29 | 0 | 11 | 0 |
| Kieltäytyminen: device_code_blocked | 19 | 0 | 10 | 0 |
| Kieltäytyminen: organisation_unavailable | 14 | 0 | 11 | 0 |
| Kieltäytyminen: expired (asiakas) | 27 | 0 | 13 | 0 |
| **Yhteensä** | **716** | **87** | **244** | **113** |

Tekstit näkyvät sivulla sellaisinaan, ja `text.ts` sisältää myös
englanninkieliset.

### Päätökset myöhempään tarkasteluun

- Rajoituksen lause näkyy vain lisäysikkunassa (*Asiakkaan tietoja rajaa
  asiakkaan oma Entra, ei tämä lista.*), koska siellä päätös tehdään.
  Listan Lisätietoja kertoo, miksi lista ei ole tietoturvaraja.
- Ylläpitäjän listassa ei ole organisaation tilaa: palvelin ei näe
  hyväksyntää, ja kuka-yhdisti-lista jätettiin v1:stä pois. Ainoa merkki
  on *Oma*. Tenant ID ei näy listassa; se näkyy lisättäessä.
- Hyväksyntäikkuna näyttää valmiin viestin ja Kopioi viesti -painikkeen;
  pelkät linkit ovat neljä kopiopainiketta ilman näkyvää URLia. Viesti
  luettelee tasot kapeimmasta alkaen, ilman tasojen kuvauksia.
- Viestissä mainitaan yksi rooli (Cloud Application Administrator) ja
  tyhjä sivu yhdellä lauseella; kierroksen 1 kysymys 1 ratkaistiin näin
  lyhentämällä.
- Vierastilin kortissa puuttuvat palvelut ovat yhdellä rivillä (*Posti,
  kalenteri ja yhteystiedot: ei vierastilillä.*) kolmen himmeän rivin ja
  selityksen sijaan.
- Kortin myöhemmät kieltäytymiset (hyväksyntä peruttu, vierastili
  poistettu, organisaatio poistettu) eivät ole tällä kierroksella;
  toteutuksessa ne lyhennetään samalla tavalla.
- Kierroksen 1 havainnot tuotannon teksteistä (`outside_tenant`,
  `integration-account-alignment`), korttien avaimesta ja v2-muotoisesta
  hyväksyntälinkistä ovat edelleen voimassa.

### Kysymykset Jarille

1. A1, A2 vai A3?
2. Riittääkö rajoitukseksi lisäysikkunan yksi lause ja listan
   Lisätietoja, vai pitääkö lauseen näkyä myös avatussa listassa?
3. Onko hyväksyntäviesti nyt sopivan lyhyt lähetettäväksi sellaisenaan?

---

## Kierros 1

Kierros: `design-system/prototypes/rounds/2026-11-27-entra-organisaatiot/`
(`NOTES.md` kertoo rakenteen, URL-parametrit, rakennuskomennon ja
tarkistuksen). Rakennettu sivu:
`design-system/prototypes/dist/2026-11-27-entra-organisaatiot/offline.html`
(kaikki upotettuna; `index.html` samassa hakemistossa ilman fontteja).
`dist/` ei ole versionhallinnassa, joten sivu tehdään uudelleen komennolla
`node design-system/prototypes/rounds/2026-11-27-entra-organisaatiot/build.mjs`.

Sivu on koottu tuotannon komponenteista muuttamatta niitä. Nyt on tämän
päivän Microsoft-polku: Integraatiot-sivun Microsoft-rivi ja sen Tasot-
painikkeen ohjattu asetus, henkilön Tiedot agenteille -sivu, yhdistämis-
ikkuna (taso, laitekoodi, valmis) ja kortti. Suunnat lisäävät uudet osat
näiden viereen. Organisaatiot ovat Esimerkki Konsultit Oy (oma), Asiakas
Yksi Oy ja Asiakas Kaksi Oy, henkilö on `henna@konsultit.example`, joka on
asiakkaissa vieraana. Yläpalkista valitaan tilanne, kieli (fi/en) ja teema
(Päivä/Yö); 390 px ja vähennetty liike toimivat kaikissa suunnissa.

### Sama kaikissa suunnissa

Kaikki suomenkieliset tekstit ovat kirjoitettuina tiedostossa
`text.ts`, ja ne näkyvät sivulla sellaisinaan:

- **Sovellusten luonti.** Ohjattu asetus alkaa valinnalla *Vain oma
  organisaatio* (vie tuotannon nykyiseen ohjeeseen) tai *Useita
  organisaatioita*. Jälkimmäinen näyttää vain kolme eroavaa kohtaa:
  Supported account types (multi-tenant, ei henkilökohtaisia tilejä, ja
  huomautus Entran vaihtuvasta sanamuodosta), nimi ja julkaisija
  (kuvitus siitä, mitä asiakkaan pääkäyttäjä näkee, julkaisijavahvistus
  vapaaehtoinen) sekä tallennus, joka lisää oman organisaation listalle.
  Tallennusvaiheessa on oikopolku olemassa olevien sovellusten vaihtamiseen
  multi-tenantiksi ja suora lause siitä, että vaihto laajentaa sitä, kuka
  sovellukset voi hyväksyä ja käyttää.
- **Lisää organisaatio.** Nimi ja Tenant ID; vihje kertoo, mistä asiakkaan
  pääkäyttäjä tunnuksen löytää ja että nimi näkyy kaikille palvelimen
  käyttäjille. Verkkotunnus, `common` ja kaksoiskappale torjutaan
  (kaksoiskappale nimeää jo olemassa olevan). Tallennus avaa hyväksynnän.
- **Hyväksyntälinkit ja viesti.** Jokaiselle tasolle linkki ja kopio,
  tason kuvaus tasotaulukon sanoin, ja valmis viesti pääkäyttäjälle:
  julkaisija ja vahvistamattomuus, tasot ja että osan voi jättää
  hyväksymättä, delegoidut oikeudet, Enterprise application ja
  *Assignment required*, poistettavuus, tarvittavat roolit ja tyhjä sivu
  lopuksi. Paneeli sanoo suoraan, ettei palvelin näe, onko asiakas
  hyväksynyt; ensimmäinen kirjautuminen on koe.
- **Rajoitus.** Lyhyt muoto: *Lista ei ole tietoturvaraja. Asiakkaan
  tietoihin pääsyä rajoittaa asiakkaan oma Entra.* Pitkä muoto on kolme
  kappaletta: mitä lista ohjaa, miksi se ei ole raja (yhteiset sovellukset,
  kirjautuminen ei sidottu yhteen organisaatioon, oma agentti tai
  komentorivi Habitatin ohi) ja mikä on oikea rajoitin asiakkaan Entrassa.
- **Poisto.** Vahvistus kertoo, että työkalut pysähtyvät seuraavassa
  kutsussa ja kortti kertoo syyn, Microsoftissa ei peruta mitään,
  tiedostot jäävät, takaisin lisääminen jatkaa ilman kirjautumista, ja
  että pääsyn katkaisee kokonaan vain organisaation oma pääkäyttäjä. Oman
  organisaation poistossa lisävaroitus.
- **Henkilön kulku.** Organisaatio (A:ssa oma vaihe, B:ssä välilehti, C:ssä
  rivi), sitten tuotannon tasovaihe ja laitekoodi, joiden alkuun tulee rivi
  *Organisaatio: Asiakas Kaksi Oy* ja vieraalle *Vieraana kirjaudut omalla
  työtililläsi* sekä huomautus, ettei palvelin tiedä hyväksyttyjä tasoja.
  Valmis-vaiheessa vierastilille: *Organisaatiossa Asiakas Kaksi Oy sinulla
  ei ole postilaatikkoa, joten yhteys sisältää vain tiedostot.*
- **Kortit.** Osoitteen alla organisaatio ja suhde (*oma organisaatio*,
  *vieraana*). Vierastilin kortissa vain SharePoint; Posti, Kalenteri ja
  Yhteystiedot *ei käytössä vierastilillä* ja selittävä rivi.
- **Kieltäytymiset.** Yhdistäessä: organisaatio ei ole hyväksynyt tasoa
  (linkki ja valmis viesti pääkäyttäjälle), ei tiliä organisaatiossa
  (kutsu hyväksymättä), laitekoodi estetty, ei sallittu tällä palvelimella,
  koodi vanheni (asiakkaalle lisärivi hyväksynnästä ja linkki). Kortissa
  myöhemmin: hyväksyntä peruttu, vierastili poistettu, organisaatio
  poistettu palvelimelta.

### Suunnat

Akseli: **missä organisaatiot näkyvät**.

0. **Nyt**: tuotanto tänään, yksi organisaatio.
1. **A Rivissä ja vaiheena.** Ylläpitäjällä sallittujen organisaatioiden
   lista on Microsoft-rivin sisällä (nimi, tunnus, Hyväksyntälinkit…,
   Poista…, Lisää organisaatio…, rajoituksen lyhyt muoto ja *Mitä lista
   rajoittaa?*). Henkilöllä Microsoft-kortit ovat allekkain, ja *Yhdistä
   toinen organisaatio…* avaa vaiheen *Minkä organisaation tiedot?*
   (oma ensin, sitten muut, jo yhdistetyt merkittyinä) ennen tasoa.
   Päättää: organisaatio on yhdistämisen ominaisuus; yksi paikka, ei uutta
   rakennetta.
2. **B Oma osio ja välilehdet.** Ylläpitäjällä Microsoft-rivi kertoo
   määrän ja vie omaan osioon rivien alla: taulukko (organisaatio, tenant
   ID, kuka lisäsi ja milloin) ja rajoitus omana korttinaan aina auki.
   Henkilöllä Microsoftin kohdalla välilehti per organisaatio; tyhjä
   välilehti tarjoaa *Yhdistä Asiakas Kaksi Oy…*. Päättää: organisaatio on
   näkymän ensisijainen jako, ja ylläpitäjä saa myös lisääjän ja ajan.
3. **C Ikkuna ja rivit.** Ylläpitäjällä rivillä vain nimet ja
   *Organisaatiot…*, joka avaa yhden ikkunan: lista vasemmalla, valitun
   hyväksyntä tai lisäyslomake oikealla. Henkilöllä jokainen sallittu
   organisaatio on oma rivinsä: yhdistetty näyttää kortin, yhdistämätön
   rivin *Ei yhdistetty · Yhdistä…*. Päättää: henkilö näkee heti, mitkä
   organisaatiot ovat tarjolla, eikä organisaatiota tarvitse kysyä.

### Suositus

**Ylläpitäjälle A, henkilölle C.** Ylläpitäjän lista on lyhyt (design
rajaa 32:een, käytännössä muutama), ja se kuuluu Microsoft-riville, koska se
on Microsoftin asetus eikä palvelimen yleinen asia; B:n oma osio irrottaa
sen rivistä ja C:n ikkuna piilottaa sen, vaikka lista on juuri se, mitä
ylläpitäjä tulee tarkistamaan. A pitää myös rajoituksen lauseen listan
vieressä. Henkilölle C on selvin: koska palvelin tietää sallitut
organisaatiot, ne voi näyttää riveinä, ja yhdistämätön organisaatio on
näkyvä tarjous eikä piilossa vaiheessa. Se poistaa yhden vaiheen
yhdistämisestä, ja kortin organisaatiorivi kertoo saman kuin A:ssa. B:n
välilehdet piilottavat muiden organisaatioiden kortit ja ongelmat.
Suosituksen kanssa yhteensopivasti A:n organisaatiovaihe jää tarpeettomaksi;
yhden organisaation palvelimella mikään ei muutu kummassakaan.

### Päätökset myöhempään tarkasteluun

- Kortin organisaatio on osoitteen alla omalla rivillään
  (*Asiakas Yksi Oy · vieraana*); kortin otsikko pysyy *Microsoft 365*.
- Vierastilin puuttuvat palvelut näytetään himmeinä riveinä eikä
  piiloteta, jotta ero oman organisaation korttiin näkyy.
- Kieltäytymisissä organisaatio on aina nimellä, ja viesti pääkäyttäjälle
  on henkilön oma lyhyt viesti; palvelimen ylläpitäjän viesti on se
  pidempi.
- Laitekoodivaiheen ohjauspalkki on vain kierroksen työkalu.
- Tuotannon teksteissä on kaksi, jotka eivät sovi usealle organisaatiolle
  ja pitää muuttaa toteutuksessa: palvelun tila `outside_tenant` sanoo
  *Ei palvelimen organisaatiossa* ja kortin `integration-account-alignment`
  puhuu palvelimen organisaatiosta. Kierros piilottaa jälkimmäisen
  ongelmakortissa ja näyttää oman tekstinsä.
- Tuotannon `IntegrationsOverview` avaa kortit avaimella
  `provider:address`; kolme saman osoitteen Microsoft-yhteyttä vaatii
  avaimen, jossa on tenant (designin `osoite~tenant`). Kierros piirtää
  Microsoft-kortit siksi itse tuotannon `AccountCard`illa.
- Hyväksyntälinkki on designin v2-muoto (`/v2.0/adminconsent`,
  `scope=.default`, `redirect_uri` nativeclient); tuotannon nykyinen
  ohje käyttää lyhyempää v1-muotoa.

### Kysymykset Jarille

1. Käykö rajoituksen sanamuoto (lyhyt ja kolmen kappaleen muoto) ja
   asiakkaan pääkäyttäjälle lähtevä viesti sellaisenaan? Erityisesti:
   kerrotaanko viestissä roolit ja tyhjä sivu, vai jätetäänkö ne pois
   lyhyyden vuoksi?
2. Suositus on ylläpitäjälle A ja henkilölle C. Hyväksytkö yhdistelmän,
   vai pidetäänkö sama suunta molemmilla puolilla?
3. Näytetäänkö ylläpitäjälle, kuka organisaation lisäsi ja milloin (B:n
   sarake), myös suosituksen A:ssa?
