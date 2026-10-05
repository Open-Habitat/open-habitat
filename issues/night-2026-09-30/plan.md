# Yön 30.9.–1.10.2026 työsuunnitelma: kaksi kapellimestaria

Tämä on yön kahden `/stint-start`-kapellimestarin yhteinen ohje. Kumpikin
ajaa kierroksia peräkkäin aamuseitsemään asti omassa tmux-ikkunassaan ja
omassa kontekstissaan, spawnaa työn worktreihin ja päivittää oman
statustiedostonsa jokaisen kierroksen lopuksi. Roolin nimi annetaan
`/stint-start`-fokusvihjeenä: `night:ui` tai `night:rest`.

Skilli kuvaa yhden kierroksen ja odottaa kierroksen jälkeen `/stint-handoff`ia.
Yöllä ei ole käyttäjää, joten käynnistysskripti (`run-night.sh`) aloittaa
kierroksen jälkeen uuden session, joka lukee tämän tiedoston, `TODO.md`:n ja
molemmat statustiedostot. Tyhjä frontier tai epäselvä tilanne on peruste
lopettaa kierros ja kirjata syy, ei keksiä työtä.

## Roolit ja omistus

**`night:ui` — käyttöliittymä jiiriin selain-design v2:n mukaan.**
Omistaa `web/`, `design-system/`, `docs/ui.md`, `docs/design-system.md` ja
issuen `review-browser-design-v2` sekä sen jalkauttavat toteutusissuet.

**`night:rest` — kaikki muu avoin työ.**
Omistaa `internal/`, `scripts/`, `contracts/`, muut `docs/`-sivut, Fleetrepon
testipalvelinjulkaisun ja issueiden rethink-läpikäynnin (alla).

Kumpikaan ei muokkaa toisen omistamia polkuja. Kun tarvitset muutosta
toisen alueelle, kirjaa pyyntö omaan statustiedostoosi ja jatka muulla.
Poikkeukset, jotka tiedetään jo nyt:

- `web/src/components/Conversation.tsx` on UI:n. Jos `rest` jatkaa
  agenttiohjausta (`build-agent-control`), se tekee daemon-puolen ja kirjaa
  tarvittavan selainmuutoksen UI:lle statustiedostoon.
- `web/src/app/GitHubOnboarding.tsx` on `show-large-clone-progress`-issuen
  törmäystoken. `rest` tekee sen ensin; UI sovittaa onboardingin vasta kun
  `rest-status.md` sanoo sen laskeutuneen (tai vasta aamulla).
- `AGENTS.md`-tiedostoja, `TESTING.md`:ää ja `TODO.md`:tä muokataan vain
  laskeutuneen tuloksen jälkeen ja pienin, rebase-turvallisin muutoksin.
  `TODO.md`:n `## 🔄 Continue here` -lohkon kirjoittaa aamulla se, joka
  lopettaa viimeisenä; sitä ennen kumpikin päivittää vain omaa
  statustiedostoaan.
- `name-open-habitat` törmää kaikkeen, eikä sitä tehdä yöllä.

## Viestikanava

`ui-status.md` ja `rest-status.md` tässä hakemistossa. Kumpikin kirjoittaa
vain omaansa ja lukee toisen jokaisen kierroksen alussa (Phase 0). Merkintä on
aikaleima, kierroksen numero, mitä laskeutui (commit), mitä on käynnissä
(run-id, issue, törmäystokenit), mitä toiselta pyydetään ja mitä jäi
Jarille. Tiedostot committoidaan mainiin jokaisen kierroksen lopussa, jotta
toinen näkee ne `git pull --rebase`in jälkeen. Taskfleetin ajot ovat silti
varausten totuus: toisen sessiot ajot menevät `--reservations`-joukkoon
skillin mukaisesti, statustiedosto on vain ihmisluettava selitys.

## `night:ui` — mitä tehdään ja missä järjestyksessä

Lähtökohta on [arvio](../review-browser-design-v2/assessment.md) ja sen
kohta "Eteneminen ja avoimet valinnat". Toteutusissueita ei vielä ole;
kapellimestari luo ne Phase 1:ssä kaistalle `design-v2` ja sarjoittaa ne.
Ehdotettu jako, jonka kapellimestari saa tarkentaa:

1. **`recut-ui-foundation`** (seq 1). Tokenit leikataan uudelleen v2:n
   mitoitustaulukosta, asettelupohjat (yläpalkki, viestivirta,
   kirjoituskenttä, sivupalkkikehys) komponenttikirjastoon, painike-,
   tilamerkki- ja ikoniprimitiivit, yksi tyylimekanismi. Todistetaan
   keskustelunäkymässä. Hyväksymisehdot ovat arvion kuusi ehtoa sekä
   mittaväitteet gatessa (arvion vertailukerros 1). Story molemmissa
   teemoissa.
2. **`fit-conversation-v2`** (seq 2). Keskustelunäkymä designin tiloihin
   pohjan päällä: tyhjä, käynnissä, vain luku, keskeytys, saapuva kysymys.
   Ei muuta toimintaa; toiminnalliset päätökset ovat `complete-conversation-ui`
   -issuessa ja aiemmissa päätöksissä (luonnokset säilyvät, epävarmat tulokset
   näytetään, ei pakkovieritystä).
3. **`fit-sidebar-v2`** (seq 3). Työtilalista, tilamerkit, tilivalikko
   (etunimi, avattuna sähköposti).
4. **`fit-onboarding-v2`** (seq 4, odottaa `show-large-clone-progress`in
   laskeutumista). Repovalitsin: kaikki repot näkyvissä, aikarajaus
   käyttäjän valinta.
5. **`fit-account-and-history-v2`** (seq 5). Tiliasetukset ja historianäkymä.
6. **`compare-v2-pairs`** (seq 6). Parikuvat jokaisesta designin tilasta
   labissa, molemmat teemat ja toteutuslaajuuden leveydet, issuekansioon
   redaktoituna. Baselinet vasta hyväksynnän jälkeen, eli ei yöllä.

Jokainen viipale on oma worktree ja laskeutuu erikseen; sarja on tiukka,
koska kaikki koskevat samoja tyylitiedostoja. Puhelinleveys kuuluu jokaiseen
viipaleeseen. Näyttö on synteettinen lab (`web/AGENTS.md`), ei oikea
palvelin.

## `night:rest` — mitä tehdään ja missä järjestyksessä

DAGin spawnattavat päät, jotka eivät ole UI:n tai Jarin:

1. **`show-large-clone-progress`** (kaista `github-clone-progress`). Ensin,
   koska UI:n onboarding-viipale odottaa sitä.
2. **Issueiden rethink-läpikäynti** `/fan-out`-ajona (menetelmä alla).
   Rinnakkain kohdan 1 kanssa; ei koske ajossa olevien issueiden tiedostoja.
3. **`build-agent-control`** (in-progress): päättyneen selainkeskustelun
   jatkaminen ja aukoton replay daemon-puolella. Selainmuutokset pyydetään
   UI:lta statustiedostolla.
4. **`plan-second-user-admission`**: suunnitelma ja suositus Jarille, ei
   toteutusta ilman hänen päätöstään.
5. **Testijulkaisu** kun kaikki yön työ on laskeutunut ja gate vihreä:
   leikkaa release ja asenna testipalvelimelle Fleetrepon
   `RELEASE-UPGRADE.md`:n mukaan, kuitit Fleetrepoen. Live-Pi-matkaa
   (`verify-live-pi-journey`) ei yritetä; se on Jarin.

Ei yöllä: `name-open-habitat`, `prove-jit-guest-isolation` (Aldern ja
VM:n kautta kulkeva koe jää aamuun, ellei kaikki muu ole valmis ja VM
tavoitettavissa ilman Aldern muutoksia), `testing`-tilan issuet (Jarin
katselmointi) ja `pilot`/`installation`-kaistat (estetyt).

## Rethink-läpikäynti consult-llm:n kautta

Tarkoitus on sama kuin [rethink-project-docs](../rethink-project-docs/item.md)
-issuessa, mutta ilman Jaria. Skillit toimivat parhaiten puhtaalla
kontekstilla, joten ne ajetaan `consult-llm`:llä, jolle annetaan skillin
`SKILL.md` ja kohdeteksti `-f`-tiedostoina. Konsultoitu malli ei lataa
skillejä itse, joten skilliteksti liitetään aina.

| Vaihe | Skilli | Malli | Kohde |
|---|---|---|---|
| 1 | `rethink-instructions` | `gpt-6-astra` | toteuttajalle suunnatut issuet, `AGENTS.md`:t |
| 1 | `rethink-document` | `claude-fable-5-1` | päätös-, suunnitelma- ja arviotekstit, ADR:t |
| 2 | `fact-check-instructions` | `claude-opus-5-5` (tai `claude-fable-5-1`) | jokainen vaiheessa 1 kirjoitettu teksti |

Skillin valinta tehdään tekstin tehtävän mukaan; epäselvässä tapauksessa
issue on ohje (`rethink-instructions`). Kehotteessa sanotaan: "Missä skilli
pyytää kysymään käyttäjältä tai sopimaan lajittelun hänen kanssaan, valitse
skillin oma suositus tai varovaisin tulkinta, älä kysy. Kirjaa jokainen
tällainen valinta erilliseen luetteloon vastauksen loppuun." Työntekijä
soveltaa palautetun tekstin, ajaa vaiheen 2, ja lisää issueen
`issuectl note <slug> --decision` -merkinnän, jossa on tehdyt valinnat ja
mitä faktantarkistus korjasi. Ristiriita aiemman Jarin päätöksen kanssa ei
ratkea yöllä: teksti jätetään ennalleen siltä kohdin ja ristiriita kirjataan
issueen ja `rest-status.md`:hen Jarille.

Yksiköt: kaikki `open`-, `in-progress`- ja `testing`-tilan issuet, jotka
eivät ole ajossa olevan runin hallussa (UI:n ja `rest`in omat ajot mukaan
lukien), sekä rethink-issuen kohdat 5–9:n dokumentit, joita ei ole vielä
käsitelty. Suljettuja issueita ei käydä läpi; ne ovat historiaa. Yksi
issue on yksi fan-out-yksikkö, ja sen ainoa kirjoituskohde on oma
issuekansio, joten yksiköt ovat erillisiä. `rethink-project-docs`-issuen
taulukon päivittää fan-outin ajuri merge-vaiheessa, eivät yksiköt.

## Jarin avoimet valinnat, joilla tämä suunnitelma etenee

Arvio jätti kaksi valintaa Jarille. Tämä suunnitelma ottaa arvion
suositukset käyttöön yön ajaksi; Jari voi kumota ne aamulla, ja silloin
vaikutus rajataan uudella issuella:

- Puhelinsovitus kuuluu toteutuslaajuuteen.
- V2-handoffin mitoitustaulukko on yhteisten tokenien lähde;
  `production-v1.md`:n lause vedosten mitoista viitteinä päivitetään.

Näiden kirjaus `review-browser-design-v2`-issuen Decisions-osioon on
UI-kapellimestarin ensimmäinen teko, lähteenä tämä suunnitelma.

## Aamun raportti

Kumpikin kapellimestari kirjoittaa viimeisen kierroksen jälkeen
statustiedostoonsa `/worktree-status`-jäsennyksellä: yhteenveto, mitä voi
testata, mitkä päätökset odottavat, keskustelunaiheet, spin-offit. Viimeisenä
lopettava kirjoittaa `TODO.md`:n `## 🔄 Continue here` -lohkon uusiksi ja
lähettää yhden `notify-jari`-viestin etuliitteellä `🤖`. Kesken jäänyt tai
kuollut worker raportoidaan ja säilytetään skillin mukaan; sitä ei
yhdistetä käsin.
