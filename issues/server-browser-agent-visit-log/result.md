# Selauskäynti keskustelussa — prototyyppikierros 22.11.2026

## Saatesanat

Kun agentti sulkee oman välilehtensä, selaimen ikkunaluettelo ei enää kerro,
mitä se teki. Tässä kolme tapaa jättää käynnistä jälki keskusteluun.
**Suosittelen suuntaa 2, Kortti:** sivusto, aika ja määrät löytyvät heti,
mutta yksittäiset tapahtumat eivät täytä keskustelua. Merkintä pysyy näkyvissä
myös silloin, kun piilotat agentin työvaiheet.

Kokeile ensin suunnan vaihtoa, sitten **Näytä käynnin tiedot** ja **Selain**.
Esimerkkitilasta voit valita käynnissä olevan työn tai yhteyskatkon.
Katko jättää tiedot osittaisiksi eikä väitä agentin lopettaneen.
Tämä on vain prototyyppi, ei vielä selauskäyntien tallennusominaisuus.
Issue jää katselmoitavaksi tilaan `testing`.

## Suunnat ja suositus

Akseli on käyntimerkinnän paikka keskustelussa, ei kolme eri tietosisältöä.
Kaikissa sama kokonaan keksitty majoituskuittien haku `stays.example`-sivustolta.

| Suunta | Oletusnäkymä | Mitä valinta tarkoittaisi |
| --- | --- | --- |
| 1 Rivi | Habitat-rivi: aika, sivusto, sivukäynnit, lataukset ja lähetykset | Kevyin kuittaus; pitkät yhteenvedot muuttuvat helposti tiheäksi tekstiksi. |
| **2 Kortti** | Oma rauhallinen kortti, määrät ja avattava erittely | Löydettävä käytön jälki, erillään agentin omasta selostuksesta ja piilotettavista työvaiheista. |
| 3 Työ | Selauskäynnin merkintä työkalurivillä | Teknisesti luonteva mutta katoaa, kun työ piilotetaan. Tämä haitta on kokeiltavissa. |

Erittelyssä ovat sivuston origin, numeroidut sivukäynnit aikoineen,
valmistuneiden tiedostojen lista ja havaittu lomakkeen lähetys. Lähetyksestä
**ei päätellä maksua tai varausta**. Käynnissä oleva merkintä näyttää vain
siihen asti havaitut määrät. Valmiin käynnin välilehti poistuu ikkunaluettelosta,
mutta merkintä säilyy keskustelussa. Käynnissä tuotannon ikkunakortti näyttää
agentin oman välilehden tekstillä, ei pelkällä värillä. Oma ikkuna ei saa tätä
merkkiä. Katkenneen yhteyden lista nimetään viimeiseksi tunnetuksi tilaksi.

## Decisions for later review

Nämä ovat prototyypin oletuksia ja toteutussuosituksia, eivät hyväksyttyjä
arkkitehtuuripäätöksiä. Tässä muutoksessa mitään ei tallenneta eikä uusia
valtuuksia anneta.

- **Origin, ei täysi URL.** Ehdotus on tallentaa scheme + host + port;
  yhteenveto näyttää hostin ja erittely koko originin. Vaihtoehtoja ovat
  polut ilman queryä tai täydet URL:t. Poluissakin voi olla henkilötietoja,
  varaustunnuksia tai salaisuuksia. Myöskään sivuotsikoita, lomakearvoja,
  evästeitä, HTML:ää tai kuvakaappauksia ei ehdoteta käyntitallenteeseen.
  Originikin voi paljastaa arkaluonteisen sivuston: tämä on tietojen
  minimointia, ei lupaus arkaluonteettomuudesta. Tarkkoihin sivuihin ei siksi
  ole paluulinkkejä. Vaihtoehtoinen tarkempi tallennus vaatii erillisen päätöksen.
- **Sivukäynti, ei ”varaussivu”.** Laskuri tarkoittaa agentin välilehden
  ylimmän tason havaittua navigointia, ei verkkopyyntöjä eikä uniikkeja sivuja.
  Sama sivu voi toistua. Vaihtoehto olisi deduplikoida URL:n perusteella,
  mutta se vaatisi tarkempia osoitetietoja. Semanttinen ”10 varaussivua”
  kuuluu agentin selostukseen, ei daemonin varmistetuksi tosiasiaksi.
  Uudelleenohjausten ja SPA-navigointien laskenta pitää määritellä toteutuksessa.
- **Lataukset:** määrä tarkoittaa valmistuneita latauksia, ei yrityksiä.
  Erittelyssä ovat esimerkin `receipt-01.pdf`-tyyppiset tiedostonimet.
  Vaihtoehto on pelkkä määrä. Suositus on käyttää olemassa olevan paikallisen
  tiedostoartefaktin viitettä, jos saatavilla, ei tallentaa latauksen URL:ää
  tai toista tiedostokopiota. Tiedostonimikin voi sisältää henkilötietoja;
  säilytys ja mahdollinen näyttöraja pitää hyväksyä ennen toteutusta.
- **Toiminnot:** lomakkeen havaittu lähetys erotetaan sivuston vahvistamasta
  lopputuloksesta ja pelkästä painalluksesta. Sisältöä ei tarvita. Jos adapteri
  ei havaitse kaikkia lähetyksiä luotettavasti, puuttuva tieto on tuntematon,
  ei nolla. Vaihtoehto on näyttää vain varmasti havaittavat toiminnot ja
  nimetä kattavuusraja. Prototyyppi ei lupaa aukotonta auditointilokia.
- **Käynnin rajaus:** yksi tunnistettu agentin selauskäyttöjakso yhdessä
  keskustelussa, päivittyvä merkintä alusta loppuun. Ei uusi merkintä joka
  sivusta eikä koko henkilökohtaisen selaimen historiaa. Agentin välilehden
  tai yhteyden tunniste, keskustelu/vuoro ja havaintojärjestys tarvitaan
  kohdistamiseen; henkilökohtaisen ikkunan tapahtumia ei liitetä agenttiin.
  Pelkkä nykyinen `agent_connected` tai lopputilan ikkunalista ei riitä
  rekonstruoimaan menneitä käyntejä.
- **Pysyvyys ja epävarmuus:** daemonilta tarvitaan tunnistettu alku, loppu
  tai keskeytys, viimeisen havainnon aika, origin-kohtaiset navigointitapahtumat,
  valmistuneet lataukset, havaittujen toimintojen tyyppi sekä kattavuustieto.
  Suositus on liittää hyväksytty suppea yhteenveto natiiviin keskusteluhistoriaan,
  ei perustaa rinnakkaista selaushistoriapalvelua. Olemassa oleva sopimus ei
  vielä tarjoa tätä; tarkka tapahtumareitti, säilytys, poistaminen ja jaettujen
  keskustelujen näkyvyys tarvitsevat myöhemmän arkkitehtuurikatselmoinnin.
  Havaintokatko jää näkyviin; yhteyden puuttuminen ei todista työn päättymistä.

## Questions for Jari

1. Valitaanko **2 Kortti**, joka säilyy näkyvissä työvaiheita piilotettaessa?
2. Riittävätkö sivustot ja määrät ilman sivujen polkuja, otsikoita tai paluulinkkejä?
3. Näytetäänkö tiedostonimet erittelyssä, vai riittääkö määrä ja yhteys olemassa
   oleviin tiedostoihin? Ketkä saavat nähdä merkinnän jaetussa keskustelussa?

## Aineisto ja tarkistus

Lähde: `design-system/prototypes/rounds/2026-11-22-server-browser-visit-log/`.
Rakennus- ja tarkistuskomennot ovat kierroksen [NOTES.md](../../design-system/prototypes/rounds/2026-11-22-server-browser-visit-log/NOTES.md):ssä.

Rakennettu itsenäinen sivu:
`/var/tmp/agent-keep/server-browser-agent-visit-log/offline.html`.
Kuvat: `/var/tmp/agent-keep/server-browser-agent-visit-log/check/`.
Tuotannon synteettisen labin selainpaneeli:
`/var/tmp/agent-keep/server-browser-agent-visit-log/baseline.png`.
Aineisto on kokonaan synteettistä; mitään ei ole julkaistu tai commitoitu kuvina
tai rakennettuna HTML:nä. Kierroksen rakennus voidaan toistaa lähteistä.

- Pohjarevisio `e976f7fe`; tarkistettu tämän kierroksen lopullinen lähde.
- `build.mjs`: onnistui. Tuotannon ennestään käyttämien CSS-moduleiden
  `composes`-järjestyksestä tulee esbuild-varoituksia; ei rakennusvirhettä.
- `check.mjs`: **842 tarkistusta läpi**, 36 suunta/kieli/leveys/teema-yhdistelmää.
  Fi/en, 1440/390 px, päivä/yö/kontrasti; avaukset, näppäimistö, elävän ja
  päättyneen välilehden ero, keskeneräiset määrät ja katkennut tieto.
  Selainkonsoli puhdas, ei verkkopyyntöjä, ei vaakaylivuotoa.
- Tarkistuksen ensimmäinen puhelinkierros paljasti valitsimen englanninkielisen
  nimen rivittymisen. Nimien väli muutettiin sitovaksi; lopullinen koko kierros
  läpäisi yhteisen `picker-check.mjs`:n muuttamatta valitsimen kirjastoa.
- Katsottu tuotannon selainpaneeli synteettisessä host-labissa; lab pysäytettiin.
  Katsottu lisäksi kierroksen työpöytä- ja puhelinkuvat sekä elävä erittely.
- Riskin mukainen oma lähde- ja kuvakatselmointi: vain paikallinen prototyyppi
  ja dokumentaatio. Riippumatonta LLM-arviota ei ajettu, koska tuotantosessiot,
  sopimus, daemonin tila ja valtuutusrajat eivät muutu.
- `python3 scripts/validate-project-view.py`: läpi (16 sivua).
  `issuectl doctor --json`: ei havaintoja. `git diff --check`: puhdas.
- Ei asennusta eikä muutosta testipalvelimeen. Go-testejä tai tuotannon koko
  selainsarjaa ei tarvita tämän prototyypin todentamiseen. Tämä ei todista
  oikean agentin tapahtumakeräystä, pysyvyyttä tai käyttäjäeristystä.
