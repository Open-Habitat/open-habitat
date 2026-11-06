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
