# Kriittiset oletukset ja niiden todentaminen

Tällä sivulla pidetään oletuksina vain väitteitä, joiden epäonnistuminen muuttaisi
ratkaisun rakennetta tai hyväksyttyä tuoterajaa. Hyväksytyt arkkitehtuurirajat
eivät ole epäilyksiä, ja tavalliset toteutus- ja häiriötestit kuuluvat omiin
osioihinsa. Aikaisempi tutkimus on [evidence-sivulla](evidence.md).

## Pi-kokeen vahvistamat ja rajaamat väitteet

[Pi-kokeessa](../issues/probe-pi-control/result.md) tutkittiin Pi 0.85.1:tä
versionoidulla disposable-fixturellä. Tulos toimitettiin revisiossa
`4187da0ec40079ec09d98539c03f840102cde616` ja suljettiin revisiossa
`71f0caafce46ecf46a743a68a4af5ee90b2009c3`. Näyttö koskee Pi:n natiivia
session-, RPC- ja extension-rajapintaa. Se ei ole näyttö tulevasta daemonista,
selaimesta, oikeasta terminaali-TUI:n siirrosta eikä workspace-/GitHub-
elinkaaresta.

| Aiempi tunnus | Mitä näyttö osoitti | Hyväksytty raja |
|---|---|---|
| A1 | Session headerin UUID säilyi samana `--session`-resumessa, headerin `cwd` yhdisti disposable-session workspaceen ja `SessionManager` löysi historian sekä workspacekohtaisesti että globaalisti. | Agentin tunnus voi olla `pi:<sessionId>`. Muutettu hakemistopolku ja tarkoituksellinen cwd-poikkeama vaativat vielä toteutuksen reunatapauskäsittelyn. |
| A2 | RPC hyväksyi promptin ja abortin sekä välitti assistant-, tool-, dialogi- ja lopputapahtumia. Käyttäjäpyyntö syntyi vain extensionin tuetusta dialogista; tavallinen chat ei tarjoa yleistä kysymysskeemaa. | UI näyttää ja ohjaa vain adapterin todentamia tapahtumia. Keskeytys koskee nykyistä agenttityötä, ei yleistä prosessipuuta. |
| A3 | `steer` ja `follow_up` hyväksyttiin ja jonot näkyivät `queue_update`-tapahtumassa. Steering toimitetaan nykyisen vuoron tool callien jälkeen, ei kesken käynnissä olevan työkalun. | Pi-kyky on todellinen, mutta painikkeet, peruminen ja tarkka käyttäjäkokemus ratkaistaan UI-katselmoinnissa; probe ei hyväksynyt designia. |
| A4 | RPC on käynnistetyn prosessin stdio-rajapinta. Käynnissä olevaan terminaali-TUI:hin ei löytynyt attach-rajapintaa, ja kaksi samanaikaista `--session`-runtimea pystyi avaamaan saman session ilman lukkoa. Erillinen RPC-prosessi pystyi jatkamaan päättyneen prosessin sessionia komennolla `pi --mode rpc --session <session>`. | Live-TUI-attach on poissuljettu. Hallittu siirto tarkoittaa TUI:n turvallista pysäytystä, natiivihistorian asettumisen varmistusta ja vasta sitten uutta RPC-runtimea samalla sessionilla. `--mode rpc --session` on tuettu käynnistysmuoto, ei tuettu live-liittyminen. Daemon sarjallistaa yhden ohjaavan runtimen per `pi:<sessionId>`. |
| Diffiä koskeva näyttö | Pi:n sisäänrakennettu `edit` palautti `details.diff`-, `details.patch`- ja `firstChangedLine`-kentät. Diffi ei ole yleinen RPC-event-kenttä; custom/unknown-työkalut ja kirjoitukset eivät välttämättä tarjoa sitä. | Pi:n tuetun `edit`-työkalun rakenteinen diff näytetään diffina. Muut työkalut käyttävät tarjoamaansa yleistä fallbackia. Bashilla tehty tiedostomuutos ei velvoita rakentamaan synteettistä diffimoottoria. |

Probe osoitti lisäksi, että persisted history, havaittu prosessi ja omistettu
ohjauskanava ovat eri faktoja. Pi ei yksin tarjoa HTTP/SSE:tä, replay-cursoria,
session-lukkoa, live-prosessirekisteriä tai browser-disconnectin yli irrotettua
runtimea. Nämä ovat tulevan adapterin ja daemonin vastuita, eivät Pi:stä
vahvistettuja ominaisuuksia.

## Hyväksytyt invarianssit

Näitä rajoja toteutetaan ja testataan; niitä ei käsitellä epävarmoina
hypoteeseina:

- workspace on `~/src`:n välitön hakemisto, asetukset ovat workspacessa eikä
  rinnakkaista workspace-rekisteriä lisätä;
- Git-repoa ei avata ennen estävän integraation onnistumista; integraation pitää
  valmistella repository ja credential-ympäristö myös agenttien tavallisille
  `git pull`- ja `git push` -komennoille, eikä pelkkä `gh`-auth-havainto riitä;
  credential-toteutusta ei ole vielä valittu;
- jokainen UI:n tukema worktree on Taskfleetin luoma ja hallitsema omistettu
  agenttiympäristö; v1 ei tarjoa mielivaltaisten manuaalisten worktreeiden
  luontia, muokkausta tai hallintaa;
- Pi-historiaa ei kopioida rinnakkaiseen keskustelutietokantaan, ja native Git,
  Pi, Linux, tmux ja Taskfleet säilyvät omien faktojensa lähteinä;
- gateway reitittää ennalta määrättyyn Linux-käyttäjään ja käyttäjän daemon toimii
  tämän UID:n oikeuksilla; selain ei valitse Unix-käyttäjää;
- browserin snapshot + POST + SSE -raja sekä rehelliset stale-, partial- ja
  unknown-tilat ovat hyväksytty lähtökohta. Tarkat sopimukset ja retention
  määritellään ennen toteutusta.

## Workspace-, GitHub- ja arkistokokeen tulokset

[Workspace-elinkaarikokeessa](../issues/probe-workspace-lifecycle/result.md)
tutkittiin 2026-09-22 disposable-fixturellä Linuxia `7.0.0-31-generic`
(x86-64), Pythonia 3.14.4, Gitiä 2.53.0, GitHub CLI:tä 2.46.0,
issuectlia 0.18.4 ja Taskfleetia 0.11.0 commitissa
`fc99e51f44d3e08e03ab80a29318376dcbd7e23d` (state schema 1). Tulos
toimitettiin revisiossa `c1e06b0af9a2835106b5f27277dd1de31766856a`.
Paikallinen koe käytti vain synteettisiä hakemistoja ja repoja. GitHubista tehtiin
Alderlla käyttäjän `jari` ympäristössä vain luku- ja autentikointihavaintoja;
etärepoa ei luotu, muutettu tai poistettu.

| Aiempi tunnus | Havaittu näyttö | Raja, ehdotus ja vaikutus käyttöliittymään |
|---|---|---|
| A5 | `~/src`:n välittömät tavalliset hakemistot löytyivät ilman rekisteriä. Git erotti pää- ja linkitetyn worktreen omilla hallintatiedoillaan. Taskfleet-ajon omistajuus pystyttiin yhdistämään tämän työn worktreehen; branchin lyhyt näyttötunnus ei ole omistajuustieto. Hakemistosymlinkki voitiin tunnistaa ilman seuraamista. | Lista luetaan edelleen levyltä. Symlinkki ja manuaalinen worktree näytetään havaittuna mutta vain luettavana; vain Taskfleetin omistamaa worktreeta hallitaan. Puuttuva liitos jää tuntemattomaksi. Siirretyn workspacen Pi-`cwd`-yhdistys on yhä testaamatta. |
| A6 | Valitulle nykyiselle private-repolle `gh`-API-auth, SSH-auth, `ADMIN`-oikeus ja `git ls-remote` toimivat samassa käyttäjäympäristössä. Tämä ei todistanut create-, push-, clone- tai delete-oikeutta, organisaation SSO:ta, tiimejä tai muuta transporttia. | Valittu GitHub OAuth -polku käyttää GitHubin vakaata numeerista identiteettiä ja toimittaa tokenin gatewaylta kerran mapped daemonille `gh auth login --with-token --git-protocol https` + `gh auth setup-git` -asennukseen. Deterministiset fixturet todistavat cross-user-/stage-rajat ja yksi private disposable-repo smoke todistaa create/origin/plain HTTPS Git push/clone/pull/delete-polun screenshotteineen. Laajaa kahden käyttäjän permission-kampanjaa tai uutta credential brokeria ei tehdä. |
| A7 / poisto | Raaka worktree-hakemiston poisto jätti Git-metadatan stale-tilaan. Päätyöhakemiston poisto rikkoi ulkopuolisen linkitetyn worktreen. Prosessi jatkoi poistetussa cwd:ssä, ja symlinkkiä seuraava haavoittuva poistotapa pääsi lähdejuuren ulkopuolelle. | Poisto on vaiheistettu, descriptor-relatiivinen no-follow-operaatio: kohde ja vaikutukset tarkistetaan uudelleen, hallitut prosessit pysäytetään omistajan kautta ja Taskfleetin worktreet puretaan Taskfleetin kautta ennen hakemistopoistoa. Jäljellä oleva Taskfleetin tai manuaalinen linkitetty worktree sekä epävarma vaikutus estävät päätyöhakemiston poiston. Lopuksi lähde havainnoidaan uudelleen. UI näyttää jokaisen onnistuneen ja epäonnistuneen vaiheen; onnistunut hakemistopoisto ei peitä jäljelle jäänyttä prosessia tai Git-metatietoa. Symlinkki ei ole tuettu poistokohde. |
| A8 | Natiivilähteet eivät sisällä käyttäjän piilotus- tai arkistovalintaa. Kokeessa perusteltiin niille pieni Unix-käyttäjäkohtainen XDG state -annotaatio, avaimena esimerkiksi `pi:<session-id>`. Pi-historia, Git-faktat, PID:t ja output eivät kuulu tiedostoon. Automaattista synopsista tai Pi:n agenttiloopin ulkopuolista otsikkokutsua ei todennettu tässä kokeessa. | `.agent-host/workspace.json` säilyy workspacen asetusten paikkana. Piilotus ja arkistointi ovat harvaa `${XDG_STATE_HOME:-~/.local/state}/native-agent-host/`-annotaatiota. Otsikkokutsu käyttää enintään ensimmäisten neljän ja viimeisten neljän käyttäjäviestin uniikkia unionia; otsikon viereinen manuaalinen toiminto noudattaa capability/pending/concurrency/nonblocking-failure-rajaa. Viimeisin onnistunut otsikko on korvattavaa esitystietoa, ei historiaa. Arkisto jatkaa samaa natiivia resume-ID:tä eikä kopioi historiaa. |

Kokeen näyttö tukee hyväksyttyä natiivia rakennetta, mutta ei ole selain- tai
tuotetesti. Erityisesti mielivaltaisten worktreeiden hallinta pysyy v1:n
ulkopuolella. GitHubin kirjoitusoperaatiot, selaimesta tehtävä credential-flow,
prosessihavainnon kattavuus, symlink-race, mountit, crash/power-loss,
Taskfleetin osittaiset virheet ja workspace-siirto tarvitsevat vielä kokeet.
Tuntematon havainto estää tuhoavan operaation eikä muutu käyttöliittymässä
onnistumiseksi.

## Aidosti avoimet, rakennetta muuttavat oletukset

| Tunnus ja väite | Tila ja tarvittava näyttö | Vastuullinen työ | Seuraus, jos väite on väärä |
|---|---|---|---|
| A6: GitHub OAuthista mapped daemonille kerran toimitettu token riittää `gh` HTTPS create-, clone-, pull- ja push-operaatioihin ilman erillistä credential brokeria. | Nykyinen yhden käyttäjän auth/read-transport todistaa vain lähtökohdan. Selain-OAuth, native-asennus ja kirjoitukset todennetaan deterministisillä identity/cross-user-fixtureillä sekä yhdellä luvallisella private disposable-repository create→push→clone/pull→delete -smokella mapped daemon -ympäristöstä. Erillistä laajaa kahden käyttäjän GitHub write -kampanjaa ei tehdä. | [GitHub-workspacet](../issues/connect-github-workspaces/item.md), [host-sopimukset](../issues/define-host-contracts/item.md), [häiriötestit](../issues/verify-v1-resilience/item.md). | Repo pysyy estävän dialogin takana. Tarvittava credential-ratkaisu tuodaan Jarin arkkitehtuuripäätökseen; sitä ei valita hiljaisesti toteutuksessa. |
| A14: Tuleva daemon pystyy omistamaan yhden Pi RPC -runtimen, pitämään sen elossa browser/SSE-katkosten yli ja palauttamaan näkymän ilman kilpailevaa resumea. | Pi-koe osoitti tarvittavan RPC-pinnan mutta ei daemonia. [ADR 0003](adr-0003-host-stack.md) ehdottaa suoraa daemonin lapsiprosessia: selain- ja gateway-katkos eivät pysäytä sitä, mutta daemonin kuolema tai host-reboot pysäyttää aktiivisen työn ja jättää natiivihistorian erikseen resumoitavaksi. Todennus vaatii yhden ohjaajan lukituksen, browser-disconnectin, daemon-restartin ja host-rebootin rajatut testit sekä natiiviin sessioniin verratun lopputilan. | [Host-sopimukset](../issues/define-host-contracts/item.md), [agenttiohjaus](../issues/build-agent-control/item.md), [häiriötestit](../issues/verify-v1-resilience/item.md). | Prosessiomistajuus tai palautumisratkaisu on suunniteltava uudelleen; tuotetta ei saa esittää selainkatkokset kestävänä pelkän Pi-historian perusteella. |

## Toteutuksessa ajettavat testit

Seuraavat ovat pakollisia hyväksyntä- tai häiriötestejä, eivät merkkejä siitä,
että hyväksytty arkkitehtuuriraja olisi vielä avoin:

- jokaisen workspace-, Git-integraatio-, GitHub-, Taskfleet-worktree- ja
  poistovaiheen väliin injektoidaan virhe ja tarkistetaan näkyvä osatulos,
  turvallinen retry sekä levyn, Gitin, Taskfleetin ja prosessien todellinen tila
  (aiempi A7);
- terminaali→RPC-siirto testataan disposable-TUI:lla: stop valmistuu, history on
  asettunut, vasta sen jälkeen käynnistyy `pi --mode rpc --session`, eikä kahta
  kirjoittavaa runtimea ole;
- snapshot-, cursor-, POST- ja SSE-sopimus testataan katkoksilla ennen POSTia,
  ennen kuittausta, streamin aikana ja cursorin vanhennuttua; epävarmaa viestiä
  ei retrytä automaattisesti (aiempi A9);
- kahden Linux-käyttäjän reititys, väärä mapping sekä gatewayn, daemonin ja Pi:n
  restartit testataan ilman ristiinpääsyä tai natiivin tiedon häviötä (aiempi A10);
- pitkä Pi-historia, stream, työkaluryhmät, `edit`-diffi, geneerinen fallback,
  näppäimistö ja screen reader testataan valitulla renderöinnillä (aiempi A11);
- luonnos, fokus ja lukukohta testataan agentin/workspacen vaihdossa, ulkoisessa
  päivityksessä, reconnectissa ja sovitun säilytysrajan sisällä (aiempi A12);
- toisen agentin vastauspyynnön saavutettava huomiotapa testataan palkki auki,
  kiinni ja selain taustalla (aiempi A13).

Jokainen tulos kirjaa päivämäärän, tutkitun version tai revision, ympäristön,
toistettavan komennon, tapahtumaesimerkit, linkin issuekohtaiseen `result.md`:hen
ja näytön tarkan rajan. Avoin kriittinen oletus tarvitsee riittävän näytön tai
Jarin hyväksymän näkyvän rajan ennen siitä riippuvaa toteutusta.
