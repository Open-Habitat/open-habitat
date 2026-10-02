# Keskustelun tiedon kulku selaimessa

Tämä on toteutussuunnitelma, ei kuvaus jo toimivasta ominaisuudesta. Jari vaihtaa juuri lukemaansa keskusteluun: selain näyttää muistissa olevan tekstin heti, vaikka Pi kirjoittaisi toiseen keskusteluun. Pi:n JSONL-tiedosto on pysyvä historia. Käyttäjän oikeuksilla toimiva daemon lukee sitä ja julkaisee tapahtumajournalin; gateway välittää sivut ja yhden SSE-virran **välilehteä** kohti todennetun Unix-käyttäjän daemonille. Selain järjestää tapahtumat keskusteluittain, mutta ei esilataa kaikkien keskustelujen historiaa. [ADR 0008](adr-0008-snappy-conversation-switching.md) päättää suunnan; [sopimukset](../contracts/v1/AGENTS.md) ovat viestien lähde.

## Tiedon reitti ja nykytilan vaihto

`internal/daemon/history_linux.go` etsii Pi:n tiedoston, validoi session ja lukee sen vakaasti; nykyinen `after` aloittaa vanhimmasta ja `native_revision` on sisällön tiiviste. `continuation_linux.go` julkaisee uusia natiiveja avaimia ohjatun vuoron asettuessa; `pi_events_linux.go` julkaisee rajatut RPC-deltat. `events_linux.go` antaa niille globaalin järjestysnumeron, samasta lukosta otetun snapshot-watermarkin ja toistoikkunan (nyt 128 tapahtumaa / 1 MiB). Sen uusi raja on 1024 tapahtumaa **ja** noin 16 MiB, ensin täyttyvän mukaan; toistoikkunan ylitys näkyy vasta vanhasta cursorista yhdistettäessä 409:nä. Yhden kehyksen nykyinen 1 MiB:n enimmäiskoko pidetään erillisenä rajana (selaimen `parseConversationEvent` hylkää suuremmat): liian suuri kehys ja erillisen per-agentti-RPC-tailin ylivuoto aiheuttavat `ring_truncated`-invalidoinnin. Tämä ei tee ulkopuolisen Pi-kirjoittajan tiedostosta journalin kanssa atomista: `snapshot.invalidated` tai uusi natiiviluku tarvitaan edelleen.

Gateway ei pidä sisältöä eikä päätä käyttäjää selaimen kentistä. `contracts/v1/{snapshot,event,history}.schema.json` ja niistä generoidut tyypit määrittävät vastausten muodot; sivutuksen muutokset tehdään ensin sopimukseen. `web/src/app/snapshot.ts`, `history.ts` ja `conversationEvents.ts` jäävät validaattoreiksi / puhtaiksi muunnoksiksi. `App.tsx`:n katalogi-EventSource ja `useConversation.ts`:n keskustelu-EventSource poistuvat: uusi `conversationJournal.ts` omistaa yhden yhteyden ja cursorin. `useConversation.ts`:n `entries`, `next`, `live`, historiapäivityssilmukka ja journal-palautuminen siirtyvät `conversationStore.ts`:ään, `conversationPager.ts`:ään ja journal-reitittimeen. `HistoryView.tsx`:n `readHistoryFetch` siirtyy pagerin käyttämäksi lukijaksi; erillinen vain luettavan historian näkymä käyttää samaa ikkunaa. `App.tsx` jää session, valinnan ja snapshotin orkestroijaksi. Reduxin `store.ts` säilyttää app-/sessiontilan, ei striimattuja rivejä. `WorkspaceRailView.tsx` lukee vain metatietoa; `BrowserConversation.tsx` lukee valitun ikkunan ja `ConversationActions.tsx` jatkaa kirjoitusten hoitoa. `useReadingPosition.ts` säilyttää DOM-ankkurin per keskustelu eikä tee datan latauspäätöksiä. `App.tsx`:n `key`-vaihto keskustelu-ID:n mukaan poistuu, mutta näkymän paikalliset fokus-, avaus- ja scroll-tilat nollataan tai palautetaan ID:n vaihtuessa.

## Kahden eri nopeudella muuttuvan rakenteen rajapinta

Alla ovat suunnittelun TypeScript-tyypit, eivät vielä olemassa olevia exportteja. `agentId` on Pi:n `pi:<sessionId>`; `web_identity_id` tulee validoidusta snapshotista eikä valitse gatewayn käyttäjää. Metadata pysyy kaikista snapshotin keskusteluista, ikkuna syntyy vain avattaessa. Store on yksi **per henkilö tässä välilehdessä**: saman henkilön uusi kirjautuminen säilyttää sen, eri henkilön vahvistettu identiteetti hävittää sen. Logout/vanhentunut istunto tyhjentää sen myös saman henkilön mahdollisesta myöhemmästä kirjautumisesta riippumatta. Ei IndexedDB:tä eikä historian `sessionStorage`-kopiota.

```ts
import type { HistoryEntry, HistoryPage } from './history';
import type { Snapshot } from './snapshot';
import type { ConversationEvent, LiveTurn } from './conversationEvents';
import type { Status } from './conversations';
type AgentId = string;
type Metadata = {
  agentId: AgentId; workspaceId: string; title: string;
  process: string; control: string; freshness: 'current' | 'stale';
  status?: Status; // ohjatun keskustelun viimeinen havainto, ei komennon kuittaus
  observationToken?: string; // snapshotin tiedostohavainto, ei historian hash
  lastChange?: string; // snapshot/event, ei katseluajan korvike
};
type Window = {
  agentId: AgentId; entries: readonly HistoryEntry[];
  byKey: ReadonlyMap<string, HistoryEntry>; // sama joukko kuin entries
  oldest?: string; newest?: string; olderCursor?: string;
  olderComplete: boolean; nativeRevision?: string; // historian hash, ei status-vihje
  live?: LiveTurn; freshness: 'current' | 'stale' | 'loading' | 'missing';
  lastViewed: number; // poistettavan keskustelun valintaan
};
type ConversationStore = {
  identityId: string;
  metadata: ReadonlyMap<AgentId, Metadata>;
  windows: ReadonlyMap<AgentId, Window>;
  getMetadataSnapshot(): readonly Metadata[];
  getWindowSnapshot(id: AgentId): Window | undefined;
  subscribeMetadata(fn: () => void): () => void;
  subscribeWindow(id: AgentId, fn: () => void): () => void;
  applySnapshot(snapshot: Snapshot): void;
  applyPage(id: AgentId, page: HistoryPage, direction: 'tail' | 'older'): 'joined' | 'replaced' | 'retry';
  applyEvent(event: ConversationEvent): void;
  markStale(id?: AgentId): void;
  view(id: AgentId): void; // LRU: enintään noin 50 ikkunaa
  dispose(): void;
};
type JournalRouter = {
  start(snapshot: Snapshot): void; // yksi yhteys, watermark + live_tail
  resume(snapshot: Snapshot): void; // sama reititin, uusi watermark palautuessa
  route(event: ConversationEvent): void; // yksi globaali cursor myös avaamattomille
  onStatusChange(fn: (id: AgentId) => void): () => void;
  onSnapshotNeeded(fn: () => void): () => void;
  stop(): void;
};
type HistoryPager = {
  tail(id: AgentId, signal: AbortSignal): Promise<HistoryPage>;
  older(id: AgentId, cursor: string, signal: AbortSignal): Promise<HistoryPage>;
  reconnect(id: AgentId, heldKeys: ReadonlySet<string>, maxPages: number,
            signal: AbortSignal): Promise<{ pages: HistoryPage[]; met: boolean }>;
  cancelAll(): void;
};
```

Toteutuksessa palautetaan muuttumaton snapshot-viite kun viesti ei koske tilaajaa. `useSyncExternalStore` käyttää erillisiä metadata- ja ID-kohtaisia tilauksia: deltat eivät herätä sivupalkkia eivätkä taustakeskustelujen renderöintiä. Tyhjä/muuttumaton tulos säilyttää saman viitteen. Metatieto päivittyy vain status-/otsikko-/snapshot-muutoksista, ei jokaisesta tekstipalasta. Nykyinen daemon ei julkaise `agent.changed`-, `title.changed`- eikä `workspace.changed`-eventtejä: `snapshot.invalidated` vaatii uuden snapshotin; `queue.changed`, `turn.settled`, `command.changed` ja `question.*` vaativat kohde-ID:n statuksen päivityksen reitittimen tilaajalle. `App` ja valitun keskustelun statusomistaja tilaavat nämä ilmoitukset; status säilyy metadatassa, joten pelkkä lämpimän ikkunan vaihto ei laukaise pyyntöä. Jatkamistodistus hankitaan erikseen vain ohjausta tarvittaessa. Statuspyynnön tulos tarkistetaan identiteetti-/generation-rajaa vasten ennen julkaisua. Vain luettavan Pi-historian ulkopuolinen kirjoittaja ei julkaise tapahtumia; `App` tarkistaa snapshotin välilehteen palatessa ja harvakseltaan sen ollessa auki, ja store vertaa natiivin agentin `observation_token`-havaintoa edelliseen. Muuttunut havainto merkitsee ikkunan stale-tilaan ja käynnistää taustalla tail-luvun. Tämä ei lupaa reaaliaikaisuutta terminaalikirjoittajalle eikä lähetä pyyntöä keskustelua vaihdettaessa. Puhdas sovitusfunktio on testattava ilman Reactia. Enintään noin 50 katsottua ikkunaa; ylimenevässä poistetaan vähiten äskettäin katsottu **kokonainen** ikkuna, metadata jää. Ei byte-laskentaa tai yksittäisen sivun vapautusta vielä; [myöhempi rajojen säätö](../issues/tune-conversation-retention/item.md) omistaa sen.

Natiivin `entry_key` on ainoa tallennetun merkinnän identiteetti. Samalla avaimella uusi historia korvaa aiemman sisällön (myös osittaisen tekstin); uusi jatkuva tapahtuma lisätään loppuun. Väliaikaiset RPC-fragmentit tunnistetaan event-ID:llä, eikä niitä yhdistetä tekstivertailulla. Saman agentin tallennettu assistant-merkintä korvaa *koko väliaikaisen vuorotailin*; muun tallennetun merkinnän jälkeen jäljellä oleva provisional pidetään kunnes korvaus voidaan todeta. `turn.settled` yksin ei ole assistant-merkintä eikä onnistumisen tae; tallentumatta jääneet väliaikaiset fragmentit merkitään epävarmoiksi ja pudotetaan seuraavan vuoron deltan tai natiivimerkinnän tullessa. Kokonaisen tiedoston historian hash vaihtuu myös tavallisessa appendissa, joten se ei yksin hylkää vanhempaa sivua. Sivutuskursorin tulee todistaa raja-avaimen edeltävän sisällön pysyneen samana; pelkkä vanhan `entry_key`:n löytyminen ei todista, ettei tiedoston alku ole kirjoitettu uusiksi. Status-koon/mtime-vihjettä ei verrata hash-arvoon. `view(id)` tekee heti `loading`-ikkunan, johon tapahtumat pääsevät. Kylmän latauksen aikana reititin jonottaa kyseisen keskustelun jo vastaanotetut eventit cursor-järjestyksessä; tail-sivun jälkeen se sovittaa päällekkäiset avaimet ja myöhemmät merkinnät sekä säilyttää korvaamattomat fragmentit. Jos 404-historia vastaa vahvistettua `status.native_history: missing` -tilaa, ikkuna on `missing`, ei virheellinen avaus. Epäselvä järjestys tai rajaan osumaton avain vaatii uuden tailin. Historiansivut liitetään vain todetusta päällekkäisestä avaimesta samassa järjestyksessä; ristiriitainen järjestys tai kelvoton prefix-todiste käynnistää tuoreen tail-latauksen. Jos sivu ei kohtaa ikkunaa, vanhaa sisältöä ei liitetä arvauksella: ikkuna korvataan uudella taililla. Toiston jälkeen katkennut pitkä väli: lue uusin sivu, sitten vanhempia rajattu määrä kunnes vanha avain löytyy; vasta silloin yhdistä, muussa tapauksessa pidä vain uusi tail. Jo näkyvä vanha teksti saa näkyä *vanhentuneena* latauksen ajan.

Pagerin uusi sopimus tarvitsee `tail`-haun (uusimmat N natiivissa järjestyksessä), taaksepäin etenevän `before`-kursorin, `older_complete`-tiedon ja raja-avaimen edeltävän sisällön todistavaan prefixiin sidotun cursorin (append tiedoston lopussa ei vanhenna sitä). Vanhemman sivun on sisällettävä myös pyynnön raja-avain päällekkäisyyden todistamiseksi (tai sama todiste erillisessä validoidussa kentässä); yksinomaan eksklusiivinen `before` palauttaisi erilliset sivut, joita ei saa liittää arvauksella. Valitaan täsmällinen kenttämuoto `contracts/v1/`-muutoksessa. Vastauksen tavuraja koskee myös yhtä pitkää merkintää; `/content/<id>` käyttää revisiosidottua ID:tä. Koko natiivin tiedoston lukukustannus mitataan, ei rakenneta daemonin toista historiaindeksiä.

## Tilanteet

| Tilanne | Missä ja mitä tapahtuu |
|---|---|
| Ensilataus | `App` varmentaa istunnon ja snapshotin; store alustaa identiteetin/metadatan, journal aloittaa snapshotin watermarkista. Valittu keskustelu hakee tailin; sitä ei väitetä ladatuksi ennen vastausta. Muiden historiaa ei haeta. Snapshotin `live_tail` sovitetaan vain sen agentin avoimeen ikkunaan. |
| Vaihto juuri nähtyyn | `App` vaihtaa valinnan, store palauttaa ikkunan ja metadatan viimeisen status-havainnon heti, ilman HTTP:tä tai EventSourcen uudelleenavausta. Luonnos ja lukuankkuri seuraavat keskustelu-ID:tä. Erillinen taustatarkistus ei ole vaihtopyyntö. |
| Vuoro käynnissä | Journal reitittää jokaisen järjestetyn eventin oikeaan ikkunaan; avaamattoman keskustelun tapahtuma vie cursoria eteenpäin ja muuttaa tarvittaessa metadataa, mutta ei luo historiaikkunaa. Väliaikainen vastaus pysyy provisionalina kunnes natiivi entry korvaa sen. |
| Lyhyt katko | Journal pitää ikkunat luettavina mutta vanhentuneina; saman instanssin ehjä replay jatkaa globaalista cursorista. Duplikaatti ohitetaan, sequence-aukko tai saman sequencen eri event-ID käynnistää palautumisen. |
| Pitkä katko / daemonin uusi instanssi | 409 (`cursor_expired`/`cursor_instance_mismatch`) tai sequence-aukko: uusi snapshot ja rajattu tailista taaksepäin sovitus; ei aukkoista ikkunaa. Vanha sisältö jää näkyviin stale-merkinnällä, kunnes yhteys on todennettu. Kirjoitusten epävarmoja tuloksia ei päätellä historiasta. |
| Per-agentti `ring_truncated` | Reititin säilyttää ehjän globaalin cursorin, pudottaa vain agentin ylivuotaneet väliaikaiset fragmentit, merkitsee tailin katkenneeksi ja lukee tämän keskustelun uusimman historian. Ei automaattista täyttä snapshotia. |
| Kauas taakse selaus | Pager lukee `before`-sivun ja lisää sen vain todistetusti yhteen jatkuvaan ikkunaan; `useReadingPosition` säilyttää näkyvän entry-avaimen ja offsetin. Spinner on sallittu; muuttunut prefix tai puuttuva raja-avain aloittaa tailista uudelleen, pelkkä uusi kokonaishash appendin jälkeen ei. |
| Kylmä avaus / poisto muistista | Yksi uusimman historian haku ja tarvittaessa erillinen status-/jatkamistodistus ohjaukseen. Vahvistettu puuttuva natiivihistoria on tyhjä `missing`-ikkuna. Ei väitetä nopeaksi muistivaihdoksi. LRU-poisto ei poista metadataa tai natiivia historiaa. |
| Logout / vanhentuminen / toinen henkilö | Session omistaja sulkee SSE:n, peruu lukupyynnöt, invalidoi generation-tokenin, tyhjentää storesta identiteetin ja `nah:<identity>:`-luonnokset. Myöhäinen vastaus tai event ei saa palauttaa vanhaa sisältöä. Saman henkilön *uusi* kirjautuminen ilman logoutia säilyttää ikkunat, mutta tarkistaa tuoreuden. |
| Toinen välilehti | Oma store ja SSE, ei jaettua historiavarastoa; daemonin omistaman Pi:n muutos saapuu kumpaankin journalin kautta. SSH/tmuxista kirjoittava Pi ei tällä hetkellä julkaise journal-eventtiä: snapshotin tiedostohavainnon muutos tai välilehden taustalla tehty hidas tarkistus merkitsee vanhan ikkunan stale-tilaan ja päivittää sen, ilman verkkopyyntöä juuri vaihtohetkellä. Toinen välilehti ei saa oikeutta ohittaa daemonin komentotarkistusta. |

## Kirjoitukset eivät ole historian päivityspyyntöjä

`ConversationActions.tsx` ja `conversations.ts` lähettävät send/steer/follow_up/clear_queue/abort/stop/continue/question; daemon päättää hyväksynnän. `useConversation.ts`:n kirjoituskohtaiset UI-tilat ja `sessionStorage`-luonnos, `last-send`, `submitted`, `uncertain` ja `continue` säilyvät erillään historiakopiosta. Lähetys näkyy `pending`-tilassa odotettaessa, `accepted` tyhjentää vain vastaavan luonnoksen, `rejected` säilyttää tekstin, kadonnut kuittaus selvitetään receipt-/status-haulla ja ratkaisematon on `uncertain`. Streamin puuttuminen ei yksin muuta lähetyksen tulosta; mitään epävarmaa kirjoitusta, jonon tyhjennystä, aborttia tai dialogivastausta ei uusita automaattisesti. Status/queue/question ja continuation proof haetaan tarvittaessa erikseen: snapshot tai pelkkä `queue.changed` ei todista komennon vastaanottoa. Dialogin request-ID kulutetaan daemonissa; epävarma vastaus pysyy epävarmana. `BrowserConversation` näyttää komennon tilan erillään tallennetusta historiasta. Logout-virhettä ei esitetä onnistuneena palvelinlogoutina, vaikka paikallinen tila piilotetaan heti.

## Toteutusjärjestys ja todentaminen

1. [Tail-first history paging](../issues/tail-first-history-paging/item.md) toteuttaa natiivin sopimuksen ja pagerin lukuoperaatiot. 2. [Recent conversation windows](../issues/recent-conversation-windows/item.md) rakentaa puhtaan storen, sovituksen ja tilaajat pagerin rajapinnalle. 3. [One browser event stream](../issues/one-browser-event-stream/item.md) ottaa yhteyden ja reitittimen omistajuuden, nostaa journalin rajat ja kytkee ikkunat ja metadatan. 4. [Browser logout cleanup](../issues/browser-logout-cleanup/item.md) yhdistää dispose-operaatiot session elinkaareen. Rajapintojen puhtaita testejä voi tehdä rinnakkain; kytkentä seuraa järjestystä.

Testaa deterministiset event-sarjat: snapshotin aikana tullut event, peräkkäinen replay, duplikaatti ja ristiriitainen sequence, `ring_truncated`, instanssin vaihto, tail-sivun ja eventin kilpailu, natiivin avaimen vaihto, eri revisio, rajaan osumaton sovitus, identity/logout kesken pyynnön ja 51. ikkuna. Selainintegraatiossa varmista nolla verkkopyyntöä ja yksi SSE tuoreessa vaihdossa, kylmän avauksen odotus, lukukohdan säilyminen ja komentokuittauksen epävarmuus. Vertaa click-to-paint, HTTP-määrää ja muistia [lähtömittaukseen](../issues/design-snappy-conversation-switching/measurements.md); [simulaatio](../issues/design-snappy-conversation-switching/simulation-output.txt) on oletuslaskelma, ei toteutuksen mittaus.
