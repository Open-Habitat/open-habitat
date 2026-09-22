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

## Aidosti avoimet, rakennetta muuttavat oletukset

Workspace-/GitHub-elinkaarikoe on edelleen ajamatta: sen issue
[probe-workspace-lifecycle](../issues/probe-workspace-lifecycle/item.md) on avoin,
eikä sillä ole tulosta. Siksi mikään alla oleva workspace-, credential- tai
GitHub-väite ei ole todennettu Pi-kokeella.

| Tunnus ja väite | Tila ja tarvittava näyttö | Vastuullinen työ | Seuraus, jos väite on väärä |
|---|---|---|---|
| A5: Workspacet ja olennaiset Git-/worktree-faktat voidaan löytää ilman workspace-rekisteriä niin, että Taskfleetin hallintakohteet voidaan erottaa muista havaituista worktreeistä. | Todentamatta. Kokeile hakemisto ilman Gitiä, repo, Taskfleet-worktree, ulkopuolinen worktree, puuttuva metadata ja ulkoinen Git-muutos; vertaa levyyn, `git worktree list`iin ja Taskfleetin natiiviin tilaan. | [Elinkaarikoe](../issues/probe-workspace-lifecycle/item.md), [workspace-elinkaari](../issues/manage-workspace-lifecycle/item.md), [agentti-worktreet](../issues/manage-agent-worktrees/item.md). | Jos luotettava erottelu ei onnistu, hallinta rajataan vain todistettuihin Taskfleet-kohteisiin ja muut faktat näytetään read-only/unknown-tilassa. Uusi annotaatio tarvitsee erillisen perustelun; yleistä rekisteriä ei lisätä huomaamatta. |
| A6: Estävä Git-integrointi voidaan toteuttaa käyttäjän natiivin ympäristön päälle niin, että agentin tavalliset pull/push-komennot todella toimivat ilman uuden credential-arkkitehtuurin valintaa tässä vaiheessa. | Todentamatta. Elinkaarikokeen pitää kirjata `git`/`gh`-versiot, repository-, remote-, transport-, credential-, oikeus- ja verkkorajat sekä puuttuva/vanhentunut tila. Myöhempi luvallinen disposable-remote-koe todentaa clonen, createn, pullin ja pushin. Pelkkä `gh auth status` ei riitä. | [Elinkaarikoe](../issues/probe-workspace-lifecycle/item.md), [GitHub-workspacet](../issues/connect-github-workspaces/item.md). | Repo pysyy estävän dialogin takana. Jos natiivi ympäristö ei riitä, credential-ratkaisu tuodaan Jarin arkkitehtuuripäätökseen; sitä ei valita hiljaisesti tässä dokumentissa. |
| A8: Arkisto, piilotus, synopsis ja vanhempikonteksti tarvitsevat korkeintaan pienet workspacen sisäiset annotaatiot natiivihistorian rinnalle. | Todentamatta. Inventoi Pi-historian ja workspace-asetuksen kentät, arkistoinnin vaikutus resumeen sekä synopsiksen lähde ja päivitys; nimeä jokainen tieto, jota ei voi rekonstruoida. | [Elinkaarikoe](../issues/probe-workspace-lifecycle/item.md), [host-sopimukset](../issues/define-host-contracts/item.md), [arkisto](../issues/archive-agent-conversations/item.md). | Toimintoa rajataan tai tarkka annotaatio viedään katselmointiin. Rinnakkaista historiaa tai yleistä workspace-rekisteriä ei synny oletuksena. |
| A14: Tuleva daemon pystyy omistamaan yhden Pi RPC -runtimen, pitämään sen elossa browser/SSE-katkosten yli ja palauttamaan näkymän ilman kilpailevaa resumea. | Pi-koe osoitti tarvittavan RPC-pinnan mutta ei daemonia. Todennus vaatii yhden ohjaajan lukituksen, browser-disconnectin, daemon-restartin ja host-rebootin rajatut testit sekä natiiviin sessioniin verratun lopputilan. | [Host-sopimukset](../issues/define-host-contracts/item.md), [agenttiohjaus](../issues/build-agent-control/item.md), [häiriötestit](../issues/verify-v1-resilience/item.md). | Prosessiomistajuus tai palautumisratkaisu on suunniteltava uudelleen; tuotetta ei saa esittää selainkatkokset kestävänä pelkän Pi-historian perusteella. |

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
