# Toteutus: ohjeet agentille käyttöönotossa ja Asetuksissa

## Saatesanat

Jari, hyväksytyt prototyypit (käyttöönotto A4.1 ja Asetukset B1) ovat nyt
tuotannossa kokeellisena ominaisuutena **Ohjeet agentille**
(`agent-instructions`, Asetukset › Kokeelliset ominaisuudet). Kun kytket sen
päälle, Asetukset › Tili -sivulle tulee kohta Ohjeet agentille. Siinä
muistilappusi (`~/.pi/agent/AGENTS.md`) näkyy Esikatselussa, Muokkaa-välilehdellä
on raaka teksti, ja painikkeet ovat Tallenna ja Peru. Toissijainen
**Muokkaa agentin kanssa** (tai **Kirjoita agentin kanssa**, jos lappua ei vielä
ole) avaa saman muistilappukeskustelun kuin käyttöönoton viimeinen vaihe.
Käyttöönotossa vaihe tulee AI-tilin jälkeen, kun ominaisuus on päällä.

Tiedoston lukee ja kirjoittaa daemonisi sinun käyttäjänäsi, kuten hyväksyit.
Tallennus on vertaa ja vaihda -kirjoitus: jos tiedosto on muuttunut sillä
välin (esimerkiksi agentti on muokannut sitä toisessa keskustelussa),
mitään ei kirjoiteta. Editori yhdistää toisen muutoksen tekstiisi kuten
työtilaeditori ja pyytää tallentamaan uudelleen. Clauden `~/.claude/CLAUDE.md`
luodaan viittausrivillä vain, jos sitä ei vielä ole. Olemassa olevaan Clauden
tiedostoon ei kosketa.

## Mistä agentin kysymykset tulevat, ja voiko ylläpitäjä lisätä niitä?

**Nyt kysymykset ovat tuotteen omaa tekstiä.** Ne on kirjoitettu
käyttöliittymän tekstiluetteloon (`web/src/text/agentNote.ts`) suomeksi ja
englanniksi, kuten muutkin käyttöliittymän tekstit. Kysymykset ovat
prototyypistä: millä kielellä agentti vastaa, millaisia vastauksia haluat,
mitä agentti ei saa tehdä kysymättä, ja viimeisenä omat sanasi.
"Keskustelu" on käsikirjoitettu: kielimalli ei aja, eikä kysymyksiä haeta
mistään mallista, taidosta tai pohjatiedostosta. Myös korjattu versio omista
sanoista tehdään säännöillä: isot alkukirjaimet ja loppupiste, ei muuta.

**Ylläpitäjä ei voi nyt lisätä kysymyksiä.** Palvelimen käyttöönoton asetukset
(ADR 0030, Asetukset › Käyttöönotto) kattavat vain repot, integraatioiden
vaiheet ja AI-tilin tarjouksen. Muistilapulle niissä ei ole kohtaa.

**Yksinkertaisin tapa lisätä ne** olisi uusi valinnainen osa samoihin
käyttöönoton asetuksiin: enintään viisi kysymystä, joista jokaisella on
suomen- ja englanninkielinen kysymys, enintään neljä vastausvaihtoehtoa
(painikkeen teksti ja lause, jonka se lisää lappuun) ja tieto siitä, saako
vastata omin sanoin. Selain saa listan samasta osoitteesta kuin
integraatioiden vaiheet (`GET /api/v1/onboarding/site`) ja kysyy ne
sisäänrakennettujen kysymysten jälkeen ennen omia sanoja. Kotihakemistoon ei
tule mitään uutta reittiä: lapun kirjoittaa edelleen sivu daemonin kautta, ja
vasta kun ihminen on nähnyt koko tekstin editorissa ja painanut Tallenna.
Ylläpitäjä muokkaisi kysymyksiä Asetukset › Käyttöönotto -sivulla muiden
vaiheiden vieressä. Ehdotus on kirjattu omaksi issuekseen (intake, ilman
kaistaa): "Administrator-defined questions for the person's agent note in
onboarding". Sitä ei ole rakennettu.

## Mitä tehtiin

- **Daemon ja rajapinta.** `GET`/`PUT /api/v1/account/agent-instructions`
  (`contracts/v1/agent-instructions.schema.json`). Daemon lukee vain tiedostoa
  `~/.pi/agent/AGENTS.md`, eikä pyyntö koskaan nimeä polkua. Kirjoitus joko
  nimeää luetun version (`base_version`) tai luo tiedoston vain, jos sitä ei
  ole (`create`, `renameat2 RENAME_NOREPLACE`). Väärä versio palauttaa
  `409 file_changed`, eikä mitään kirjoiteta. Linkkiä, kovaa linkkiä,
  erikoistiedostoa ja muuta kuin UTF-8-tekstiä ilman CR- ja NUL-merkkejä ei
  näytetä eikä korvata. Gateway välittää pyynnön CSRF-tarkistuksen jälkeen.
  Sääntö on kirjattu `internal/AGENTS.md`:hen.
- **Jaettu editori** `web/src/components/InstructionsEditor.tsx`: Esikatselu ja
  Muokkaa, Tallenna ja Peru, yhdistäminen työtilaeditorin `threeWay`-funktiolla
  ja ristiriitakortti `EditorConflict`.
- **Muistilappukeskustelu** `web/src/components/AgentNoteStep.tsx` (A4.1):
  ensin kieli, sitten vastaustyyli ja se, mitä ei saa tehdä kysymättä, ja
  viimeisenä omat sanat. Korjausta tarjotaan erikseen (Pidä omani / Käytä
  korjattua). Lappu näytetään editorissa ennen tallennusta. Olemassa olevalle
  lapulle kieltä ei kysytä, vanha teksti säilyy tavu tavulta (Ennallaan), ja
  lisäys näkyy merkinnällä Uutta.
- **Käyttöönotto**: vaihe Ohjeet agentille reitin viimeisenä, sen jälkeen yksi
  selkokielinen lause ja Missä ohjeet ovat? -kohta. Tee myöhemmin ja Jätä
  ennalleen eivät kirjoita mitään.
- **Asetukset › Tili › Ohjeet agentille** (B1) ja asetushaun rivi.
- **Kielen oletus** `web/src/app/answerLanguage.ts`. Sääntö on kirjattu
  funktion kommenttiin ja alle.

### Kielen arvaussääntö

1. Jos aikavyöhykkeellä on omat kielet (Helsinki: suomi ja ruotsi;
   Maarianhamina ja Tukholma: ruotsi ja suomi), valitaan niistä ensimmäinen,
   joka on selaimen kielilistassa. Helsinki ja `fi` antavat suomen,
   suomenruotsalainen `sv-FI` antaa ruotsin, ja suomalainen Tukholmassa saa
   suomen.
2. Jos tällaisella vyöhykkeellä kumpaakaan ei ole selaimen listassa, valitaan
   vyöhykkeen ensimmäinen kieli. Poikkeus: jos ihminen on itse valinnut
   Habitatin kieleksi englannin, valitaan englanti. Monella suomalaisella on
   englanninkielinen kone, mutta joka valitsee englannin myös täällä,
   tarkoittaa sitä.
3. Muualla valitaan ensimmäinen kolmesta kielestä, joka on selaimen
   kielilistassa.
4. Muuten valitaan Habitatin käyttöliittymän kieli.

## Tarkistukset

- Go: `./scripts/test-focused.sh --area go --go-package` paketeille
  `./internal/daemon`, `./internal/gateway` ja `./internal/experimental`,
  sekä `--area contracts`. Uusissa daemonin testeissä ovat
  luonti vain puuttuvalle tiedostolle, Clauden tiedoston koskemattomuus,
  vertaa ja vaihda -kirjoitus (vanhentunut versio, toisen kirjoittajan muutos,
  välissä poistettu tiedosto), linkkien ja muun kuin tekstin hylkääminen sekä
  HTTP-raja. Vastaukset tarkistetaan skeemaa vasten.
- Web: `--area web` ja uudet Vitest-testit (kielen arvaus, lapun teksti ja
  korjaus, editorin yhdistäminen ja ristiriita). Nopean tarkistuksen ainoa
  punainen kohta on `finnishScan`, joka on punainen myös mainissa
  (`LanguageSettings.tsx`, "Suomi"). Se on kirjattu omaksi issuekseen.
- Selain (`OH_BROWSER_WORKERS=2`): uusi `agent-instructions.spec.ts`
  (käyttöönoton vaihe oikealla daemonin käsittelijällä, Asetusten
  vertaa ja vaihda -kirjoitus, yhdistäminen ja Muokkaa agentin kanssa) myös
  `--repeat-each 3`, sekä `settings-experimental`, `settings-search`,
  `github-first-onboarding`, `site-ai-key`, `onboarding-default-repos`,
  `pi-onboarding-host`, `account-settings` ja `onboarding-notices`.
- Riippumaton katselmointi (`/llm-review`: GPT-6 Astra etsi, Claude Fable 5.2
  yritti kumota): kuusi löydöstä, kaikki selaimen tilankäsittelyssä ja kaikki
  korjattu samassa työssä (`/assess-findings`: 6 × FIX). Tärkein niistä: jos
  tiedosto muuttui käyttöönoton aikana, tallennus olisi korvannut vastaukset
  toisella tekstillä. Daemonin kirjoituksesta tai rajapinnasta ei löytynyt
  mitään.
- Ruutukaappauksia ei otettu. Hyväksytyn prototyypin kuvat ovat
  `/var/tmp/agent-keep/new-user-agent-instructions-template/`-hakemistossa.

## Päätökset myöhempää katselmointia varten

- **Keskustelu on käsikirjoitettu, ja malli ei aja.** Vaihtoehto oli oikea
  Pi-keskustelu. Hyväksytty prototyyppi oli käsikirjoitettu, kysymykset ja
  vastausvaihtoehdot ovat kiinteät, ja lappu kirjoitetaan sivulta. Malli toisi
  kustannuksen, viiveen ja vaihtelua ilman uutta sisältöä. Myös omien sanojen
  korjaus tehdään säännöillä.
- **GitHub-kuvauksen tarkistuskysymys jäi pois.** Selain tuntee GitHubista vain
  nimen, sähköpostin ja kuvan. Kuvauksen lukeminen olisi uusi luku GitHubista.
  Nimi tulee lappuun ("Olen …"), jos se on tiedossa.
- **Muokkaa agentin kanssa avaa saman muistilappukeskustelun, ei
  Pi-keskustelua kotihakemistossa.** Habitat ei tunne kotihakemistoa
  työtilana (työtilat ovat vain `~/src`-hakemiston alla), joten oikea
  keskustelu vaatisi uuden host-ominaisuuden. Keskustelu lisää vain uutta
  olemassa olevan tekstin perään, kuten B1:ssä luvattiin.
- **Käyttöönoton vaihe näkyy vain, kun kokeellinen ominaisuus on päällä.** Uusi
  tili alkaa kaikki kokeelliset pois päältä, joten käytännössä vaiheen näkee
  vain se, joka on kytkenyt ominaisuuden päälle ja kulkee reitin uudelleen.
  Kokeilupaikka on siksi Asetukset › Tili, jonka Kirjoita agentin kanssa on
  sama vaihe. Vaihtoehtona olisi palvelinkohtainen oletus kokeellisille
  ominaisuuksille. Sitä ei ole.
- **Linkitettyä `AGENTS.md`:tä ei seurata.** Esimerkiksi dotfiles-linkki
  näytetään ilmoituksena "ei voi muokata täällä", eikä tekstiä näytetä.
  Atominen korvaus korvaisi linkin tavallisella tiedostolla. Vaihtoehto olisi
  kirjoittaa linkin kohteeseen, mutta se olisi uusi polku pyynnön ulkopuolelta.
- **Kokoraja on 256 KiB, ei 1 MiB.** Lappu luetaan jokaisen keskustelun alussa,
  ja isompi tiedosto on todennäköisemmin jotain muuta.
- **Uusi tiedosto luodaan oikeuksilla 0600.** Korvaus säilyttää olemassa olevan
  tiedoston oikeudet.
- **Clauden tila voi olla myös `unknown`.** Tämä tarkoittaa, että tiedostoa ei
  voitu lukea turvallisesti. Lähderivi sanoo silloin, ettei tiedetä, lukeeko
  Claude ohjeita.
- **Muokkaa-välilehti on tavallinen tekstikenttä, ei CodeMirror.** Koska
  tekstikenttä ei merkitse omaa riviä punaisella, ristiriitakortti näyttää nyt
  molemmat rivit (`EditorConflict`-komponentin uusi `mine`-ominaisuus), ja
  lähteenä on "levy", koska muuttajaa ei tiedetä.
- **Lappu kirjoitetaan käyttöliittymän kielellä**, ja vastauskieli on yksi
  lause siinä. Kielet ovat suomi, englanti ja ruotsi.
- **Kadonnut vastaus tallennukseen** luetaan uudelleen. Se lasketaan
  tallennetuksi vain, jos tiedostossa on täsmälleen sama teksti. Muuten
  editori pyytää lataamaan sivun ja tarkistamaan. Mitään ei lähetetä
  uudelleen automaattisesti.
- **Prototyyppikierrosten hakemistot poistettiin.** Niitä oli kuusi
  (`2026-11-21-onboarding-instructions*` ja `2026-11-21-instructions-settings*`),
  ja ne ovat Git-historiassa (`scripts/from-history.sh`).
