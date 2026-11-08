# Kierros 1: yksi kortti ja yksi avautumispaikka

Kierros: `design-system/prototypes/rounds/2026-11-08-tarjouskortit/`
(`NOTES.md` kertoo sivun, suunnat ja tarkistuksen). Akseli on se, kuinka
paljon kortti itse kantaa. Avautumispaikka on kaikissa suunnissa sama oikean
reunan paneeli, eli sama paikka, jota `proto-conversation-assets` suositteli
keskustelun näkymien ja tiedostojen listalle. Paneelin yläreunan
*‹ Näkymät ja tiedostot* vie siihen listaan. Sisältö on kaikissa sama: yksi
näkymä, CSV, kuva, julkinen näkymä, PDF ja kansio.

- **Nyt**: tuotanto tänään. Näkymä avautuu viereen, tiedosto ikkunaan keskustelun päälle, kansio Tiedostot-paneeliin; kortit ja painikkeet vaihtelevat lajin mukaan.
- **1 Kortti**: koko kortti on yksi painallus, joka avaa kohteen oikeaan paneeliin; lataus ja jakaminen ovat paneelin yläpalkissa.
- **2 Rivi**: jokainen tarjous on yksi rivi, jonka ainoa painike on Avaa (oikea paneeli); lataus ja jakaminen ⋯-valikossa.
- **3 Otsake**: jokaisella kortilla sama tietorivi (laji · koko · kuka näkee) ja samat kaksi painiketta: Avaa (oikea paneeli) ja Lataa.

Kuvat: `evidence/r1-<suunta>-<vaihe>-<leveys>-<teema>.avif`. Vaiheet ovat
`0-oletus`, `0-kortit` (kaikki kuusi korttia korkeassa ikkunassa),
`1-nakyma`, `2-taulukko`, `3-kuva`, `4-asiakirja` ja `5-kansio` (avattuna
kortista), `6-lista` (yläpalkin sirusta) sekä `7-valikko` (Rivin ⋯).

## Mitä suunnat päättävät yhteisesti

Kaikki kolme suuntaa ratkaisevat issuen erot samalla tavalla:

- Johdantoriviä (*Agentti tarjoaa ladattavaksi:*) ei ole.
- Otsikko on aina tavallisella kirjasimella, ja polku näkyy tietorivillä.
- Kuka näkee on merkki: lukko tai maapallo. Sitä muutetaan paneelissa.
- Ensisijainen teko on aina *Avaa*, ei *Lataa*.
- Kaikki avautuu samaan paneeliin, myös kansion tiedostot.

Suunnat eroavat siinä, mitä kortille jää.

## Host-tiedot

Uutta tallennetta ei tarvita. Suunnissa on kaksi kohtaa, joita host ei
tänään tarjoa:

- **Näkymän lataus zipinä** (Otsakkeen *Lataa (.zip)* näkymäkortilla ja
  paneelin ⤓). Näkymä on jäädytetty tiedostojoukko, joten tämä on uusi reitti.
  Ilman sitä näkymäkortin toinen painike olisi *Avaa omalle välilehdelle*.
- **Tiedostoa ei voi tehdä julkiseksi.** Siksi tiedostojen näkyvyysrivi on
  pelkkä teksti *Vain sinulle* ilman kytkintä. Suunnat eivät lupaa
  tiedostojen jakamista.

Tiedoston esikatselu paneelissa korvaa tuotannon esikatseluikkunan
(`AttachmentPreview`). Sama sisältö, joka nyt piirretään ikkunaan
(taulukko, kuva, pdf.js-sivut), piirrettäisiin paneeliin. Data tulee samoista
`inline`- ja `download`-reiteistä. Kansion tiedostolistassa käytetään
nykyistä tarjouksen manifestia.

## Suositus

**1 Kortti.** Se poistaa erot kokonaan, koska kortilla ei ole lajikohtaisia
painikkeita lainkaan. Painikkeet ovat paneelissa, joka on kaikille sama ja
on myös listan paikka. Kortti pysyy tunnistettavana, koska siinä on kuvan
ja kansion pienoiskuvat, toisin kuin Rivissä. Rivi on tiivein, mutta sen
⋯-valikko piilottaa latauksen yhden painalluksen taakse ja kuva katoaa
keskustelusta. Otsake on lähimpänä nykyistä ja pitää Latauksen esillä.
Siinä on kuitenkin edelleen kaksi painiketta jokaisessa kortissa, ja se
tarvitsee näkymän zip-latauksen pysyäkseen yhtenäisenä.

## Kysymykset Jarille

1. Mikä kortti: Kortti (`r1-1-kortti-0-kortit-1440-light`), Rivi
   (`r1-2-rivi-0-kortit-1440-light`) vai Otsake
   (`r1-3-otsake-0-kortit-1440-light`)?
2. Kelpaako sama paneeli myös taulukolle, kuvalle ja PDF:lle
   (`r1-1-kortti-2-taulukko-1440-light`) nykyisen ikkunan sijaan
   (`r1-0-nyt-2-taulukko-1440-light`)?
3. Riittääkö näkyvyydeksi kortilla pelkkä lukko tai maapallo
   (`r1-1-kortti-0-oletus-1440-light`), vai pitääkö *Julkinen*-kytkin olla
   näkymäkortilla kuten nyt (`r1-0-nyt-0-kortit-1440-light`)?

## Ympäristö ja näyttö

Rakennettu tuotannon komponenteista tämän worktreen puusta (pohja
`2e4c7d53e`). Kuvat on otettu Playwright Chromium 153:lla headless-tilassa,
1440 × 900 ja 390 × 844 (kosketus), DPR 2, vaalea ja tumma. `check.mjs`:
534 tarkistuspistettä, konsoli puhdas. Nyt-näkymän PDF-ikkunassa ei ole
esikatselua, koska pdf.js:n worker puuttuu prototyypistä; tuotannossa
esikatselu näkyy.

```
node design-system/prototypes/rounds/2026-11-08-tarjouskortit/build.mjs
open-habitat agent view offer --current --source design-system/prototypes/dist/tarjouskortit/offline.html --title "Tarjouskortit · kierros 1" --idempotency-key 4e756d44-05dc-4762-b044-59493a64182a --json
```

# Kierros 2: Kortti, avautumispaikka ja jakaminen

Kierros: `design-system/prototypes/rounds/2026-11-08-tarjouskortit-2/`
(`NOTES.md` kertoo sivun, riffit ja tarkistuksen). Kaikissa riffeissä on
kierroksen 1 Kortti. Riffit eroavat siinä, missä avattu kohde on ja mistä
se jaetaan. Oletusnäkymässä CSV-taulukko on jo auki, joten paikka näkyy heti.

- **A Viereen**: kohde avautuu oikeaan paneeliin; paneelin yläpalkissa Julkinen-kytkin ja Avaa omalle välilehdelle.
- **B Ikkuna**: kohde avautuu ikkunaan keskustelun päälle, sama yläpalkki; Esc sulkee.
- **C Merkki**: työpöydällä viereen, puhelimessa ikkunaan; kortin lukko tai maapallo avaa jakamisen suoraan kortista.

Jokaisessa riffissä jokaisen lajin (näkymä, taulukko, kuva, PDF, kansio)
voi tehdä julkiseksi samalla tavalla kuin näkymän nyt: *Julkinen*-kytkin
julkaisee 30 päiväksi, päivä avaa keston ja *Kopioi linkki* kopioi
osoitteen. Jokaisen lajin voi myös avata omalle välilehdelle. Välilehden
osoite on kohteen pysyvä osoite `/n/…`, sama jonka linkki antaa.

Kuvat: `evidence/r2-<riffi>-<vaihe>-<leveys>-<teema>.avif`. Vaiheet:
`0-oletus` (taulukko auki), `0-kortit` (kaikki kortit, mitään ei auki),
`1-nakyma` … `5-kansio`, `6-julkinen` (taulukko julkiseksi; C:ssä kortin
merkistä), `7-valilehti-<laji>` (oma välilehti; A:ssa joka laji, C:ssä
taulukko) ja `8-lista`.

## Host-tiedot

**Miten näkymä tulee julkiseksi nyt** (ADR 0035, `internal/gateway/view_links_linux.go`):
gateway pitää omaa varaustaan (`view-links.json`), yksi omistajaa ja
jäädytettyä näkymää (`v…`) kohden. Varauksessa on pysyvä osoite `/n/<entry>`
sovelluksen omassa osoitteessa ja sisältösalaisuus näkymäavaruuden omaan
osoitteeseen. Julkisuus on varauksen `PublicUntil`-päivä, eikä salaisuus
vaihdu koskaan. Julkinen luku kulkee gatewayn kautta omistajan daemonin
kiinteästä reitistä `/view-export/<id>/<polku>`. Oma välilehti
`/view?id=…` varaa osoitteen ja korvaa itsensä osoitteella `/n/<entry>`.
Omistajalle sivu näyttää näkymän kehyksessä, ja julkisen osoitteen gateway
ohjaa sisältöosoitteeseen. Asetusten Tili › Näkymien osoitteet listaa
varaukset. Agentti ei näe osoitetta.

**Tiedostotarjous nyt** (`internal/daemon/fileoffers_linux.go`): se on samanlainen
jäädytetty kopio manifesteineen (`~/.local/state/open-habitat/files/<f…>/`).
Sitä luetaan vain omistajan istunnolla reiteistä `/api/v1/file-offers/<id>/files/<polku>`
ja `/zip`. Gateway näyttää selaimessa vain kuvat, äänen ja videon; kaikki
muu tulee ladattavana tiedostona. Tiedostotarjouksella ei ole pysyvää
osoitetta, julkisuutta eikä omaa välilehteä; ainoa poikkeus on kuvan
*Avaa alkuperäinen*.

**Mitä host tarvitsee, jotta tiedosto, taulukko, kuva tai kansio saa saman osoitteen:**

1. Varaus hyväksyy myös tarjouksen tunnuksen (`f…`) näkymän rinnalla.
   `validViewAddress` hyväksyy nyt vain `v…`-tunnuksen. Laji selviää
   tunnuksen etuliitteestä. Uutta tallennetta ei tarvita.
2. Daemoniin kiinteä tarjouksen lukureitti gatewaylle, vastaava kuin
   `/view-export/`. Lukukoodi on jo olemassa (`FileOffersHandler`),
   mutta gatewayn julkinen välitys kutsuu vain näkymäreittiä.
3. Aloitussivu. Näkymällä on HTML-aloitustiedosto, jonka osoitteeseen
   välitys ohjaa; tiedostolla ei ole. Julkiseen osoitteeseen tarvitaan
   hostin tuottama sivu: otsikko, tiedostolista, kuvat näkyvissä,
   taulukosta esikatselu, jokainen tiedosto ja zip ladattavina, sama
   hiekkalaatikko-CSP. Pelkän kuvan tai videon voi ohjata suoraan
   tiedostoon. PDF:lle näkymäpalvelin ei ilmoita tyyppiä, ja
   hiekkalaatikko estää selaimen oman PDF-katselimen, joten julkisella
   sivulla PDF on ladattava, ellei sivuun tuoda pdf.js:ää.
4. Oma välilehti omistajalle: `/file?id=f…` samaan tapaan kuin
   `/view?id=…`. Sivu varaa osoitteen, korvaa itsensä osoitteella
   `/n/<entry>` ja näyttää saman esikatselun kuin paneeli (taulukko,
   pdf.js, kuva, kansion lista). Tämä on sovelluksen sivu, eikä se avaa
   gatewaylle uutta pääsyä.
5. Rajat. Tarjous voi olla 512 MiB, näkymä 50 MiB, ja julkisen osoitteen
   päiväraja on 2 GiB osoitetta kohden. Iso tarjous mahtuu siis vain
   muutamaan lataukseen päivässä. Raja pidetään tai sitä säädetään.
6. Selaimen osoitetila (`viewLinks`) on avattu näkymän tunnuksella. Se
   avataan tarjouksen tunnuksella tai yleisellä tunnuksella, ja asetusten
   lista näyttää myös tiedostot (nimi esimerkiksi *Jaetut osoitteet*).

Kierroksen 1 kohta pysyy: näkymän lataus zipinä (⤓ näkymällä) on uusi reitti.

## Päätökset myöhempää tarkistusta varten

- **Oman välilehden osoite on sama kuin jaettava osoite** (`/n/…`), kuten
  näkymällä nyt. Vaihtoehto olisi erillinen yksityinen osoite. Hylkäsin
  sen, koska yksi osoite on helpompi ymmärtää ja vastaa nykyistä
  näkymää.
- **Tiedoston julkinen sivu on hostin tuottama sivu**, ei raakatiedosto.
  Raakatiedostona CSV näkyisi tekstinä ja PDF latautuisi, jolloin lajit
  näyttäisivät taas erilaisilta.
- **Kansio jaetaan kokonaan.** Kansion yksittäisellä tiedostolla ei ole
  omaa osoitetta, koska tarjous on yksi jäädytetty kopio.
- **Kytkin julkaisee 30 päiväksi** kuten näkymäkortti nyt.

## Suositus

**A Viereen.** Paikka on sama, jota keskustelun listalle suositeltiin
(`proto-conversation-assets`), ja keskustelu näkyy kohteen vieressä.
Sama yläpalkki kantaa jakamisen ja oman välilehden joka lajille, eikä
kortille palaa painikkeita, jotka kierros 1 poisti. B antaa leveälle
taulukolle ja PDF:lle enemmän tilaa, mutta peittää keskustelun, ja paneelin
saa tarvittaessa leveämmäksi. C:n kortin merkki on hyvä, jos haluat jakaa
linkin avaamatta kohdetta. Se tuo kuitenkin kortille toisen painettavan
kohdan, ja pelkkänä merkkinä se jo on A:n kortin tietorivillä. Puhelimessa
A ja C päätyvät lähes samaan.

## Kysymykset Jarille

1. Mihin kohde avautuu: viereen (`r2-a-viereen-0-oletus-1440-light`),
   ikkunaan (`r2-b-ikkuna-0-oletus-1440-light`) vai viereen ja puhelimessa
   ikkunaan (`r2-c-merkki-0-oletus-390-light`)?
2. Jaetaanko vain yläpalkista (`r2-a-viereen-6-julkinen-1440-light`) vai
   myös suoraan kortin merkistä (`r2-c-merkki-6-julkinen-1440-light`)?
3. Kelpaako oma välilehti, kansiolla tiedostolista
   (`r2-a-viereen-7-valilehti-kansio-1440-light`), myös siksi, minkä
   julkisen linkin saaja näkee?

## Ympäristö ja näyttö

Rakennettu tuotannon komponenteista tämän worktreen puusta (pohja
`b19b2d2bb`). Kuvat on otettu Playwright Chromiumilla (`chromium-1243`)
headless-tilassa, 1440 × 900 ja 390 × 844 (kosketus), DPR 2, vaalea ja
tumma. `check.mjs`: 1008 tarkistuspistettä, konsoli puhdas. Välilehti on
kuvitettu sivun sisään; oikeaa uutta välilehteä prototyyppi ei avaa.

```
node design-system/prototypes/rounds/2026-11-08-tarjouskortit-2/build.mjs
open-habitat agent view offer --current --source design-system/prototypes/dist/tarjouskortit-2/offline.html --title "Tarjouskortit · kierros 2" --idempotency-key 512bc1bf-fdff-4772-a004-9a53ed2aa4ea --json
```

# Kierros 3: kortti avaa ja sulkee, toiminnot kortissa

Kierros: `design-system/prototypes/rounds/2026-11-08-tarjouskortit-3/`
(`NOTES.md` kertoo sivun, riffit ja tarkistuksen). Kaikissa riffeissä on
kierroksen 2 A Viereen: kohde avautuu oikeaan paneeliin. Saman kortin uusi
painallus sulkee paneelin. Avattu kortti on korostettu aksenttireunuksella
ja -taustalla, ja sen › on aksentinvärinen; hiiren alla › vaihtuu ✕:ksi.
Riffit eroavat siinä, miltä kortin omat toiminnot (julkinen ja kesto,
*Kopioi linkki*, oma välilehti, lataus) näyttävät, mikä korvaa hiiren
kosketusnäytöllä ja mitä paneelin yläpalkkiin jää. Oletusnäkymässä
työpöydällä PDF on auki ja kiitossivun kortti piirretty hiiren alle;
puhelimessa näkyy riffin kosketustila.

- **A Kulma**: hiiren alla kortin oikeaan yläkulmaan pienet kuvakkeet (julkinen, välilehti, lataus); kosketuksella aina näkyvissä; paneelin yläpalkissa sama rivi.
- **B Palkki**: hiiren alla kortin alareunaan palkki lyhyin sanoin, avatussa kortissa pysyvästi; kosketuksella pitkä painallus; paneelissa vain ✕.
- **C Jako**: kortissa aina lukko tai maapallo, joka avaa jakamisen; ⋯ hiiren alla (välilehti, lataus); kosketuksella ⋯ on paneelin yläpalkissa.

Kuvat: `evidence/r3-<riffi>-<vaihe>-<leveys>-<teema>.avif`. Vaiheet:
`0-oletus`, `0-kortit` (kaikki kortit, mitään ei auki), `1-nakyma` …
`5-kansio` (avattuna, kortti korostettuna), `6-hover` (hiiri CSV-kortilla;
puhelimessa `6-kosketus`), `7-julkinen` (CSV julkiseksi kortista),
`8-valilehti` (oma välilehti kortista) ja `9-lataus`.

## Host-tiedot

Kierros ei tuo uusia host-vaatimuksia. Kierroksen 2 lista pätee
sellaisenaan: tiedostotarjouksen julkisuus ja pysyvä osoite, `/file?id=f…`
-välilehti ja näkymän lataus zipinä. Lisäksi kierros olettaa seuraavat:

- **Kortin auki-tila on selaimen tila.** Sovellus tietää jo, mikä näkymä on
  paneelissa. Kortti saa tiedon propsina ja palauttaa painalluksesta
  avaa- tai sulje-intentin. Host ei osallistu.
- **Hover ei ole ainoa tie.** Design-järjestelmän mukaan olennainen ei saa
  olla pelkästään hoverissa. Kaikissa riffeissä toiminnot tulevat näkyviin
  myös näppäimistöfokuksella (`:focus-within`), ja kaikki ovat myös
  paneelin kautta saatavilla (B:ssä työpöydällä avatun kortin pysyvässä
  palkissa). Kuka näkee näkyy A:ssa ja B:ssä tietorivin merkkinä ja C:ssä
  aina näkyvänä merkkinä.
- **Kortti ei enää ole yksi `<button>`.** Painikkeita ei voi sijoittaa
  painikkeen sisään, joten kortin painallus on kortin alla oleva kerros ja
  toiminnot ovat sen päällä. Toteutuksessa tämä on `FileOffer`- ja
  `ViewOffer`-korttien rakennemuutos.

## Päätökset myöhempää tarkistusta varten

- **Puhelimessa oletuksena mitään ei ole auki**, koska paneeli peittäisi
  keskustelun ja kortin tilan.
- **A:n maapallo julkaisee yhdellä painalluksella 30 päiväksi** kuten kytkin
  nyt. Kesto muutetaan päivästä sen vieressä.
- **B:n hover-palkki peittää tietorivin eikä kasvata korttia**, jotta
  keskustelu ei hyppää, kun hiiri kulkee sen yli.
- **A:ssa kosketusnäytön kuvakkeet ovat kortin alimmalla rivillä**, eivät
  kulmassa, koska kulmassa ne kaventaisivat otsikon 390 px:n leveydellä.

## Suositus

**A Kulma.** Se tekee täsmälleen sen, mitä pyysit: julkaisu, välilehti ja
lataus ovat yhden painalluksen päässä kortissa. Se käyttää symboleita
sanojen sijaan, kuten design-järjestelmä haluaa. Sama kuvakerivi on myös
paneelin yläpalkissa, joten opittavaa on yksi asia. B on selkein ensi
kertaa käyttävälle, koska siinä on sanat, mutta se on raskas: palkki peittää
tietorivin, avattu kortti kasvaa, eikä pitkää painallusta löydä ilman
neuvoa. C on rauhallisin ja näyttää aina, kuka kohteen näkee, mutta
välilehti ja lataus ovat kahden painalluksen takana. Puhelimessa C:n
toiminnot ovat vain avatun kohteen yläpalkissa.

## Kysymykset Jarille

1. Mikä riffi: A (`r3-a-kulma-0-oletus-1440-light`), B
   (`r3-b-palkki-0-oletus-1440-light`) vai C (`r3-c-jako-0-oletus-1440-light`)?
2. Mikä puhelimessa: aina näkyvät kuvakkeet (`r3-a-kulma-0-oletus-390-light`),
   pitkä painallus (`r3-b-palkki-0-oletus-390-light`) vai toiminnot vain
   avatun kohteen yläpalkissa (`r3-c-jako-6-kosketus-390-light`)?
3. Riittääkö julkaisuun pelkkä maapallo (`r3-a-kulma-7-julkinen-1440-light`),
   vai pitääkö sana *Julkinen* ja kytkin näkyä (`r3-b-palkki-7-julkinen-1440-light`)?

## Ympäristö ja näyttö

Rakennettu tuotannon komponenteista tämän worktreen puusta (pohja
`b55b79e58`). Kuvat on otettu Playwright 1.63:n Chromiumilla
(`chromium-1243`) headless-tilassa, 1440 × 900 ja 390 × 844 (kosketus),
DPR 2, vaalea ja tumma. `check.mjs`: 734 tarkistuspistettä, konsoli puhdas.
Pitkä painallus on tarkistettu kosketuksen pointer-tapahtumilla, ei oikealla
laitteella. Välilehti on kuvitettu sivun sisään, ja lataus näyttää vain
ilmoituksen.

```
node design-system/prototypes/rounds/2026-11-08-tarjouskortit-3/build.mjs
open-habitat agent view offer --current --source design-system/prototypes/dist/tarjouskortit-3/offline.html --title "Tarjouskortit · kierros 3" --idempotency-key 19200bd5-6b93-4459-a9ea-12ffabfe3d4a --json
```
