# Microsoft 365 usealle organisaatiolle: prototyyppikierros 1

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

## Sama kaikissa suunnissa

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

## Suunnat

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

## Suositus

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

## Päätökset myöhempään tarkasteluun

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

## Kysymykset Jarille

1. Käykö rajoituksen sanamuoto (lyhyt ja kolmen kappaleen muoto) ja
   asiakkaan pääkäyttäjälle lähtevä viesti sellaisenaan? Erityisesti:
   kerrotaanko viestissä roolit ja tyhjä sivu, vai jätetäänkö ne pois
   lyhyyden vuoksi?
2. Suositus on ylläpitäjälle A ja henkilölle C. Hyväksytkö yhdistelmän,
   vai pidetäänkö sama suunta molemmilla puolilla?
3. Näytetäänkö ylläpitäjälle, kuka organisaation lisäsi ja milloin (B:n
   sarake), myös suosituksen A:ssa?
