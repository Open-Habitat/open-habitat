# Kierros 1: integraatioiden tasot ja mitä kukin sallii

Kierros: `design-system/prototypes/rounds/2026-11-06-integraatiotasot/`
(NOTES.md kertoo suunnat ja vuorovaikutukset). Akseli: miten taso kootaan ja
nimetään. Yläpalkin *Näkymä* vaihtaa ylläpitäjän Palvelinintegraatiot-listan,
henkilön tason valinnan ja henkilön tilikortin välillä; henkilön näkymissä
valitaan Microsoft 365, Google tai Dropbox.

- **Nyt**: kolme tasoa, joiden nimi on ainoa kuvaus ylläpitäjän listassa; Luonnokset on todellisuudessa vain luku postin luonnoksia lukuun ottamatta.
- **Neljä tasoa**: uusi taso Kaikki paitsi postin lähetys Täyden ja Luonnosten väliin, ja jokaisen tason rivillä lukee, mitä se sallii, mitä ei ja mitä ei voi estää.
- **Ruudukko**: tasot korvataan palveluittaisella ruudukolla Lukee / Muokkaa / Lähettää; solut, joita palvelu ei osaa erottaa, on yhdistetty.
- **Pohja ja poikkeukset**: kaksi tasoa, Vain luku ja Täysi, ja Vain lukuun valittavat poikkeukset palveluittain lauseina.

Kuvat: `evidence/d<suunta>-<näkymä>-<leveys>-<teema>.avif`, suunta 0 = Nyt,
1 = Neljä tasoa, 2 = Ruudukko, 3 = Pohja ja poikkeukset. Ylläpitäjän lista:
`d1-yllapitaja-1440-light.avif` jne.

## Mitä kukin päättää

| | Tasoja Microsoftilla | Ylläpitäjän rivi | Henkilön valinta | Google ja Dropbox |
|---|---|---|---|---|
| Nyt | 3 (Täysi nimetön pääsovellus) | Vain nimi ja tila | Kortit, palvelut vain valitussa | Google: Luonnokset ei tarjolla |
| Neljä tasoa | 4 | Sallii / Ei salli / Ei voi estää | Kortit, palvelut kaikissa näkyvissä | Google: Kaikki paitsi Gmailin muutokset; Dropbox: Kaikki paitsi jakaminen |
| Ruudukko | 4 yhdistelmää ruudukkoina | Ruudukko jokaiselle yhdistelmälle | Solut palveluittain; Microsoftilla vain yhdistelmä, jolle on tunnukset | Mikä tahansa yhdistelmä yhdellä sovelluksella |
| Pohja ja poikkeukset | Pohjat + 2 poikkeusyhdistelmää | Lause: ”Agentit lukevat kaiken. Lisäksi: …” | Vain luku + valintaruudut | Mikä tahansa yhdistelmä; Gmailin ruutu estetty syineen |

## Mitä palvelut voivat teknisesti rajata

Tarkistettu 6.11.2026 palveluiden omasta dokumentaatiosta. Mikään alla oleva
ei ole kokeiltu oikeassa tenantissa.

**Microsoft Graph (delegoidut oikeudet)**

- *Mail.ReadWrite ilman Mail.Send* pitää: luonnoksen lähettäminen
  (`POST /me/messages/{id}/send`) ja `sendMail` vaativat Mail.Sendin, eikä
  korkeampaa vaihtoehtoa ole
  ([message: send](https://learn.microsoft.com/en-us/graph/api/message-send?view=graph-rest-1.0)).
  Mail.ReadWrite saa silti siirtää, poistaa ja muokata viestejä. Saapuneen
  postin säännöt ja edelleenlähetys vaativat MailboxSettings.ReadWrite-oikeuden,
  jota mikään taso ei pyydä.
- *Calendars.ReadWrite lähettää kutsuja, eikä sitä voi rajata*: ”When you
  create an event that includes attendees, the server sends invitations to all
  attendees … and can't be configured”
  ([Create event](https://learn.microsoft.com/en-us/graph/api/user-post-events?view=graph-rest-1.0)).
  Muokkaus ja poisto lähettävät samoin päivitykset ja peruutukset. Ainoa raja
  on Calendars.Read.
- *Files.ReadWrite(.All) voi luoda jakolinkkejä*: `createLink` vaatii vähintään
  Files.ReadWrite, ja `scope: anonymous` antaa kenelle tahansa avautuvan linkin,
  ellei organisaation ylläpitäjä ole kieltänyt anonyymejä linkkejä
  ([createLink](https://learn.microsoft.com/en-us/graph/api/driveitem-createlink?view=graph-rest-1.0)).
  Muokkausta ilman jakamista ei voi myöntää; rajaus on vain organisaation
  SharePoint-jakoasetuksissa, koko tenantille. (Files.ReadWrite.AppFolder
  rajaisi OneDriven sovelluskansioon kuten Dropboxin taso, mutta ei
  SharePointia.)
- *Jokainen taso on oma sovelluksensa*: Entra antaa delegoidun tunnuksen
  `scp`:hen kaikki sovellukselle kyseiseen resurssiin hyväksytyt oikeudet
  pyynnöstä riippumatta
  ([Scopes and permissions](https://learn.microsoft.com/en-us/entra/identity-platform/scopes-oidc),
  [delegated access primer](https://learn.microsoft.com/en-us/entra/identity-platform/delegated-access-primer)).
  Uusi taso tarkoittaa siis neljättä Entra-sovellusta ja ylläpitäjän
  hyväksyntää: Mail.ReadWrite, Calendars.ReadWrite, Contacts.ReadWrite,
  Files.ReadWrite.All, Sites.ReadWrite.All (ei Mail.Sendiä).

**Google**

- Gmailissa ei ole luonnoksia ilman lähetystä: gmail.compose on ”Manage drafts
  and send emails”, gmail.modify ”Read, compose, and send”
  ([Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)).
  Ainoa raja on gmail.readonly (gmail.labels muokkaa vain tunnisteiden nimiä,
  ei viestejä). Googlen välitaso voi siis olla vain ”Gmail vain luku, muu
  muokattavissa”.
- Kalenterin `events.insert` lähettää kutsut vain, jos agentti pyytää
  (`sendUpdates`, oletuksena ei), mutta muokkausoikeus antaa aina mahdollisuuden
  pyytää
  ([events.insert](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert)).
  calendar.app.created rajaisi sovelluksen itse luomiin kalentereihin.
- Drive-oikeus sisältää jakamisen; erillistä ”muokkaa mutta älä jaa”
  -oikeutta ei ole.
- Yksi sovellus riittää kaikille yhdistelmille, koska Google myöntää pyydetyt
  oikeudet (koodissa `googleLevelScopes`).

**Dropbox**

- Pyynnön `scope`-parametri saa pyytää osajoukon sovelluksen oikeuksista, ja
  tunnus saa juuri ne
  ([OAuth guide](https://docs.dropboxapi.com/dropbox-api/docs/oauth)).
  Jakaminen on oma `sharing.write`-oikeutensa (koodin `dropboxScopes`), joten
  ”kaikki paitsi jakaminen” on todellinen raja Koko Dropbox -sovelluksella
  ilman uutta sovellusta. Rclonen synkronointi ei tarvitse sharing-oikeuksia.

## Mitä näkymä olettaa hostilta

- Microsoftille neljäs sovellusosio (esim. `microsoft_nosend`) ja taso
  `microsoftLevelScopes`-tauluun; tilakortti tunnistaa tason
  `microsoftLevelOf`:lla (posti drafts, muut full). Nykyinen ”Luonnokset,
  ei lähetystä” nimetään uudelleen ”Luonnokset, muu vain luku”.
- Googlelle uusi pyyntö (gmail.readonly + calendar + contacts + drive) samalle
  sovellukselle ja tasotunnistus `googleAskedLevel`/`Level`-funktioon.
- Dropboxille pyyntö ilman sharing-oikeuksia ja tasotunnistus
  `dropboxRules`-sääntöihin (`files.content.write` ilman `sharing.write`).
- Ylläpitäjän rivien sallii/ei/ei voi estää -kuvaukset ovat selaimen
  katalogitekstiä tason tunnisteen perusteella; host lähettää vain tason ja
  onko sille tunnukset.
- Ruudukko ja Pohja ja poikkeukset vaatisivat lisäksi, että henkilön valinta
  välitetään palveluittaisena yhdistelmänä eikä tasona, ja Microsoftilla
  yhdistelmä sovitetaan ylläpitäjän sovelluksiin.

## Suositus

**Neljä tasoa.** Se korjaa juuri sen, minkä Aino ja Jari kohtasivat: heidän
odottamansa taso on olemassa ja oikealla nimellä, ja jokaisen tason rivi
kertoo ylläpitäjälle ennen tunnuksia, mitä se sallii, mitä ei ja mitä
palvelu ei anna estää. Se on ainoa suunta, joka ei lupaa enempää kuin
Microsoft pystyy pitämään: Ruudukko ja Pohja ja poikkeukset näyttävät
vapaalta valinnalta, mutta Microsoftilla jokainen yhdistelmä on silti
ylläpitäjän erikseen lisäämä sovellus, joten henkilö törmää ”ei ole tällä
palvelimella” -ilmoitukseen. Ruudukon yhdistetyt solut kannattaa silti ottaa
talteen: ne ovat selkein tapa näyttää, miksi kalenteria ei voi muokata ilman
kutsuja.

## Kysymykset Jarille

1. Onko uuden tason nimi oikea (`d1-valinta-microsoft-1440-light.avif`,
   ”Kaikki paitsi postin lähetys”), ja kelpaako nykyisen uusi nimi
   ”Luonnokset, muu vain luku”?
2. Riittääkö ylläpitäjän rivillä kolme riviä Sallii / Ei salli / Ei voi
   estää (`d1-yllapitaja-1440-light.avif`), vai pitäisikö kuvaus olla
   palveluittain kuten Aseta tunnukset -dialogissa
   (`d1-aseta-tunnukset-1440-light.avif`)?
3. Tarjotaanko Googlelle välitaso ”Kaikki paitsi Gmailin muutokset” ja
   Dropboxille ”Kaikki paitsi jakaminen” (`d1-valinta-google-…`,
   `d1-valinta-dropbox-…`), vai pidetäänkö niissä nykyiset tasot?

# Kierros 2: riffit Ruudukosta

Kierros: `design-system/prototypes/rounds/2026-11-06-integraatiotasot-2/`
(NOTES.md kertoo riffit ja vuorovaikutukset). Jarin 6.11. päätöksen mukaan
riffataan Ruudukkoa: kohdat ilman oikeutta selviksi ja käyttöliittymä
väljemmäksi vertailutaulukolla tai erikseen avautuvilla taulukoilla. Akseli:
missä ja missä muodossa tason oikeudet näytetään.

- **Vertailutaulukko**: tasot rinnakkain sarakkeina ja oikeudet riveinä, jokaisessa solussa ✓ Kyllä tai ✕ Ei; ylläpitäjän tasorivit ovat yhden rivin mittaisia.
- **Avautuva ruudukko**: tasot ovat yhden rivin mittaisia, ja tason ruudukko avautuu rivin alle yksi kerrallaan.
- **Erillinen ikkuna**: listat pysyvät tiiviinä, ja ruudukko avautuu omaan ikkunaansa, jossa tasoa vaihtamalla näkee, mitkä solut muuttuvat.

Kaikissa kolmessa solu ilman oikeutta on ✕ ja kieltomuoto (”Ei lähetä”,
”Ei muokkaa eikä lähetä kutsuja”), kun kierroksella 1 siinä luki sama teksti
kuin sallitussa solussa harmaana. Yhdistettyjen solujen vinoviivoitus on
poistettu; kahden sarakkeen solun varoitusrivi kertoo, mitä palvelu ei anna
estää. Tasot ovat kierroksen 1 Neljä tasoa -joukko, ja henkilö valitsee
tason, ei yksittäisiä soluja.

Kuvat: `evidence/r2-d<riffi>-<näkymä>-<leveys>-<teema>.avif`, riffi 1 =
Vertailutaulukko, 2 = Avautuva ruudukko, 3 = Erillinen ikkuna. Ylläpitäjän
lista ja Microsoftin valinta kaikissa neljässä leveys- ja teemayhdistelmässä,
muut vaaleana molemmilla leveyksillä ja tummana 1440:llä.

## Mitä kukin päättää

| | Ylläpitäjän lista | Henkilön valinta | Tilikortti |
|---|---|---|---|
| Vertailutaulukko | Tasorivit nimi + tila + toiminto; palvelun alla yksi taulukko kaikista tasoista | Taso valitaan sarakkeen otsikosta, valittu sarake rajattu | Oman tason sarake |
| Avautuva ruudukko | Tasorivi + yhden lauseen kuvaus + Näytä oikeudet; yksi ruudukko auki | Valitun kortin ruudukko avautuu korttiin | Kuvaus + Näytä oikeudet |
| Erillinen ikkuna | Tasorivi + kuvaus + Mitä taso sallii; ei ruudukkoa sivulla | Kortit + Vertaa tasoja ruudukkona -ikkuna, josta voi valita | Kuvaus + ikkuna |

## Palveluiden tekniset rajat

Ennallaan, kierroksen 1 tarkistuksen mukaiset; kaikki riffit näyttävät ne
samoin: Microsoftin kalenterin muokkaus lähettää aina kutsut ja tiedostojen
muokkaus sisältää jakolinkit (kahden sarakkeen solu + varoitus), Gmailissa
muutos sisältää lähetyksen eikä Googlella ole luonnostasoa, Dropbox erottaa
muokkauksen jakamisesta, ja Microsoftin jokainen taso on oma sovelluksensa
(tunnuksettoman tason saa valita vasta, kun ylläpitäjä on asettanut sen).

## Mitä näkymä olettaa hostilta

Ei mitään uutta kierrokseen 1 nähden: host kertoo vain tasot ja onko niille
tunnukset. Taulukon rivit, Kyllä/Ei-arvot, kieltomuodot ja varoitukset ovat
selaimen katalogitekstiä tason tunnisteen perusteella.

## Suositus

**Vertailutaulukko.** Se vastaa suoraan siihen, mikä Ainolle ja Jarille oli
epäselvää: Luonnokset-sarakkeesta näkee yhdellä silmäyksellä, että sen
kalenteri-, yhteystieto- ja tiedostorivit ovat Ei, kun viereisessä Kaikki
paitsi postin lähetys -sarakkeessa ne ovat Kyllä. Avautuva ruudukko ja
Erillinen ikkuna näyttävät yhden tason kerrallaan, joten ero pitää muistaa
tasolta toiselle. Taulukko on myös lyhyempi kuin kierroksen 1 neljä ruudukkoa:
yksi taulukko palvelua kohden. Puhelimessa neljä saraketta mahtuvat 390
px:iin, mutta otsikot tavuttuvat useammalle riville
(`r2-d1-yllapitaja-390-light`). Erillisen ikkunan tasovalitsin kannattaa
pitää mielessä, jos taulukko kasvaa (esim. lisää palveluita).

## Päätöksiä myöhempään tarkasteluun

- **Henkilö valitsee tason, ei soluja**, kuten Neljä tasoa -suunnassa;
  kierroksen 1 Ruudukossa solut olivat klikattavia. Microsoftilla vapaa
  yhdistelmä johti silti ”ei tällä palvelimella” -ilmoitukseen.
- **Sallittu solu on vihertävä (`--ah-ok-soft`), kielletty valkoinen ja ✕
  punainen merkki.** Merkki ja sana kantavat tiedon, väri tukee.

## Kysymykset Jarille

1. Mikä riffi: `r2-d1-yllapitaja-1440-light`, `r2-d2-yllapitaja-1440-light`
   vai `r2-d3-ikkuna-1440-light`?
2. Onko solu ilman oikeutta nyt selvä: kieltomuoto ja ✕
   (`r2-d2-yllapitaja-1440-light`, ”Ei lähetä”), vai riittäisikö pelkkä
   ✕ Ei kuten taulukossa (`r2-d1-yllapitaja-1440-light`)?
3. Valitaanko taso henkilön näkymässä taulukon sarakkeesta
   (`r2-d1-valinta-microsoft-1440-light`) vai korteista
   (`r2-d2-valinta-microsoft-1440-light`)?

## Näkymä (kierros 2)

```
node design-system/prototypes/rounds/2026-11-06-integraatiotasot-2/build.mjs
tw browser-open design-system/prototypes/dist/integraatiotasot-2/offline.html
```

`check.mjs` (kierroksessa) läpäisee 552 tarkistuspistettä puhtaalla
konsolilla.

# Kierros 3: yksi työnkulku neljälle sovellukselle

Kierros: `design-system/prototypes/rounds/2026-11-06-integraatiotasot-3/`
(NOTES.md kertoo suunnat ja vuorovaikutukset). Jari valitsi 6.11.
Vertailutaulukon, ja solu ilman oikeutta on lyhyesti ✕ Ei. Taulukko ei saa
näkyä koko ajan, ja Microsoftin neljä Entra-sovellusta pitää tehdä yhdessä
työnkulussa. Työnkulku on `proto-m365-setup-flow`-kierroksen 4 dialogi
(kaistale oikeista, peitetyistä Entra-leikkeistä ja A1b2:n yksi nappi), ja
leikkeet ovat sen kierroksen 3 leikkeitä sellaisinaan. Akseli: missä
järjestyksessä neljä sovellusta tehdään.

- **Sovellus kerrallaan**: kierroksen 4 ohje neljästi, kerran kullekin tasolle. Yläreunassa näkyy, mikä sovellus on menossa, ja kunkin tunnukset tallentuvat sen lopussa.
- **Vaihe kerrallaan**: jokainen vaihe tehdään kaikille neljälle ennen seuraavaa. Lopuksi kaikki neljä client ID:tä kopioidaan App registrations -listasta kerralla.
- **Yksi komento**: Entran Cloud Shelliin liitetään yksi komento, joka luo kaikki neljä sovellusta, ja sen tulostama rivi liitetään takaisin. Käsin tehtävä ohje on varalla.

Kaikissa kolmessa taulukko näkyy samoin. Ennen asetusta se on auki
Microsoftin rivin alla, sarakeotsikoissa tasojen tila (*Ei tunnuksia* /
*Tarjolla*), ja rivillä on yksi *Luo sovellukset…* -painike tasokohtaisten
*Aseta tunnukset…* -rivien sijaan. Kesken jääneessä asetuksessa taulukko
pysyy auki (*1/4 tasoa tarjolla*, *Jatka asetusta…*). Kun kaikilla tasoilla
on tunnukset, rivi on yhden rivin mittainen, ja taulukko avautuu *Mitä tasot
sallivat* -painikkeesta. Googlen ja Dropboxin rivit toimivat samoin.

Kuvat: `evidence/r3-d<suunta>-<näkymä>-<leveys>-<teema>.avif`. Suunta 1 on
Sovellus kerrallaan, 2 Vaihe kerrallaan ja 3 Yksi komento. Jokaisen suunnan
oletusnäkymä on `alku`. Sivun tilat on kuvattu suunnassa 1: `ennen`, `kesken`,
`asetettu` ja `asetettu-auki`. Työnkulun kohtia ovat `sovellus2`,
`oikeudet`, `julkinen3`, `tunnukset`, `komento` ja `tulos`. Jokaisesta on kuva
molemmilla leveyksillä ja molemmilla teemoilla; `oikeudet` on vain
1440-vaaleana.

## Mitä kukin päättää

| | Järjestys | Tallennus | Painalluksia | Tenant ID | Client ID:t |
|---|---|---|---|---|---|
| Sovellus kerrallaan | sovellus › vaihe › alakohta | jokaisen sovelluksen lopussa | noin 68 | kerran | sovelluksen Overview-sivulta, yksi kerrallaan |
| Vaihe kerrallaan | vaihe › sovellus › alakohta | lopussa | 69 | kerran | kaikki listan sarakkeesta kerralla |
| Yksi komento | ei vaiheita Entrassa | lopussa | 3 + komento | rivillä | rivillä |

## Mitä näkymä olettaa hostilta

- **Neljäs Microsoft-osio.** Kierroksen 1 oletus pysyy: uudelle tasolle
  tarvitaan neljäs osio (esim. `microsoft_nosend`) ja taso
  `microsoftLevelScopes`-tauluun.
- **Kaikki neljä kerralla.** Neljä sovellusta tallennetaan yhdellä
  pyynnöllä (Vaihe kerrallaan, Yksi komento) tai sovellus kerrallaan (Sovellus
  kerrallaan). Kumpikin on neljä `microsoft*`-osion tallennusta samalla
  tenantilla. Sovellus kerrallaan ei tarvitse hostilta mitään uutta. Kahdelle
  muulle kertatallennus on selaimen silmukka nykyisen tallennuksen päällä,
  tai uusi komento, joka tallentaa kaikki tai ei mitään.
- **Tarkistus ennen tallennusta.** Sama client ID kahdelle tasolle hylätään
  selaimessa. Brokerin pitäisi tarkistaa sama, koska se on ainoa, joka näkee
  kaikki osiot.
- **Komennon tulos jäsennetään selaimessa.** Yksi komento ei tuo hostille
  uutta luottamusta: komento ajetaan ylläpitäjän omassa Cloud Shellissä hänen
  omilla tunnuksillaan, ja hostille tulevat vain samat tunnisteet kuin käsin
  (client ID:t ja tenant). Rivin jäsennys on selaimen tehtävä.
- **Taulukon tila tulee hostilta.** Sarakeotsikon *Tarjolla* / *Ei
  tunnuksia* on sama tieto kuin nyt: onko tasolla tunnukset.

## Ei tarkistettu

- **Komentoa ei ole ajettu oikeassa tenantissa.** Liput ovat Azure CLI
  2.x:n Microsoft Graph -komennot muistin varassa. Avoimia asioita on kolme:
  toimiiko Cloud Shell organisaatiossa, jolla ei ole Azure-tilausta (sen
  ohjeissa tilaus on ollut vaatimus; UI varoittaa tästä), ehtiikö
  palveluprinsipaali syntyä ennen `permission grant`ia ilman odotusta, ja
  näkyvätkö `permission grant`illa tehdyt hyväksynnät Entrassa *Granted for*
  -tilana.
- **Kopiointi listasta.** Vaihe kerrallaan olettaa, että listan
  *Application (client) ID* -sarakkeen arvon voi kopioida. Leikkeessä arvot
  on peitetty, eikä kopiointinappia ole tarkistettu.
- **Puuttuvat leikkeet.** Cloud Shellistä ei ole leikettä.

## Suositus

**Sovellus kerrallaan**, ja **Yksi komento** sen rinnalle, jos Cloud Shell
kelpaa.

**Sovellus kerrallaan** on kierroksen 4 ohje sellaisenaan. Jokaisen
sovelluksen lopussa on tallennus, joten valmis taso on heti tarjolla ja
keskeytys ei hukkaa mitään (`r3-d1-kesken-1440-light`). Ylläpitäjä on koko
ajan saman sovelluksen sivuilla Entrassa eikä hae sovellusta uudelleen
listasta joka vaiheessa. Vaihe kerrallaan vaatii 12 hakua ja pitää neljä
puolivalmista sovellusta auki loppuun asti, ja sen ainoa todellinen etu,
client ID:t yhdellä kertaa listasta, on tarkistamatta.

**Yksi komento** on ainoa suunta, jossa neljä sovellusta todella syntyvät
yhdellä teolla. Ylläpitäjän kannalta se vastaa suoraan Jarin pyyntöön, ja
Contosoin kaltaiselle käyttöönotolle se on minuutti 68 painalluksen sijaan.
Sen ehto on, että komento kokeillaan ensin oikeassa tenantissa ja Cloud Shell
aukeaa myös ilman Azure-tilausta. Siksi se on suosituksessa käsin tehtävän
ohjeen rinnalla eikä sen tilalla.

## Päätöksiä myöhempään tarkasteluun

- **Kaikki neljä tasoa tehdään aina.** Työnkulussa ei valita tasoja.
  Henkilöille tarjottavien tasojen rajaus on eri asia kuin sovellusten
  rakentaminen.
- **Kaikkien neljän nimessä on taso** (*Open Habitat – täysi*), vaikka
  tuotannon täysi sovellus on nyt pelkkä *Open Habitat*. Kun neljä tehdään
  kerralla, Entran listassa nimet erottuvat vain näin.
- **Tasokohtaiset rivit poistuivat ylläpitäjän listasta**, koska taulukon
  sarakeotsikko kertoo saman (taso ja tila).

## Kysymykset Jarille

1. Mikä järjestys: `r3-d1-alku-1440-light` (sovellus kerrallaan),
   `r3-d2-alku-1440-light` (vaihe kerrallaan) vai `r3-d3-alku-1440-light`
   (yksi komento)?
2. Kokeillaanko Yksi komento -suuntaa oikeassa tenantissa
   (`r3-d3-komento-1440-light`), eli saako ohje pyytää ylläpitäjää ajamaan
   komennon Cloud Shellissä?
3. Onko taulukon paikka oikea: auki rivin alla ennen asetusta
   (`r3-d1-ennen-1440-light`) ja *Mitä tasot sallivat* -painikkeen takana sen
   jälkeen (`r3-d1-asetettu-1440-light`, `r3-d1-asetettu-auki-1440-light`)?

## Näkymä (kierros 3)

```
node design-system/prototypes/rounds/2026-11-06-integraatiotasot-3/build.mjs
tw browser-open design-system/prototypes/dist/integraatiotasot-3/levels.html
```

`check.mjs` (kierroksessa) läpäisee 2743 tarkistuspistettä puhtaalla
konsolilla.
