# Tuotantodesign v1

Tämä on yhden palvelimen, Pi:n ja työpöytäselaimen tuotantodesignin kanoninen
visuaalinen ja vuorovaikutuksellinen määrittely. [Komponenttikatalogi](component-catalog-v1.md)
määrittää julkiset komponenttisopimukset. [Staattinen korjauskierros](ui_kits/production-v1/index.html)
näyttää niiden olennaiset yhdistelmät. Nämä ovat toteutuksen syötteitä, eivät
ajettava tuote.

Alkuperäiset [keskusteluvedokset](../issues/receive-designer-v1/design/vedokset/)
ja [workspace-vedokset](../issues/receive-designer-v1/design/workspaces/) säilyvät
muuttamattomina referensseinä. Jos ne ovat ristiriidassa tämän tiedoston,
[hyväksyttyjen UI-päätösten](../issues/review-ui-v1/review.md) tai
[v1-host-sopimuksen](../contracts/v1/AGENTS.md) kanssa, tämä määrittely ratkaisee
tuotantodesignin; koneellinen sopimus ratkaisee saatavilla olevan tiedon ja
komennot.

## Rajaus ja omistajuus

V1 on suomenkielinen desktop-UI yhdelle URL:n määräämälle palvelimelle ja Pi:lle.
Mobiili, palvelimen vaihto, B11-prosessikeskus, yleinen worktree-manageri,
selaimen credential-säilö, OS-ilmoitukset ja muut harnessit eivät kuulu tähän.

Näkymäkomponentit saavat valmiiksi johdetun näyttömallin ja lähettävät käyttäjän
aikomuksia. Ne eivät:

- avaa SSE:tä, kutsu HTTP:tä tai muodosta command ID:tä;
- päättele capabilityä historiasta, prosessista tai näkyvästä painikkeesta;
- yhdistä snapshotia, eventtejä, command ledgeriä tai natiivilähteitä;
- aloita retryä, resumea, rollbackia tai fokussiirtoa omin päin;
- tallenna draftia, komentokuittia, otsikkoa, arkistoa tai Pi-historiaa.

Reitti omistaa valinnan; sovelluksen synkronoitu malli omistaa snapshotin,
tapahtumat, komentojen hyväksynnän ja operaatiot; yksi tabikohtainen repository
omistaa `sessionStorage`-luonnokset ja keskeneräiset komentokuitit. Komponentin
paikallista tilaa ovat vain avoin valikko, dialogin syötearvo, fokus ja mitattu
rivikoko. Työskentelyjonon valittu send mode kuuluu tabin agenttikohtaiseen UI-
malliin, ei Composer-komponentin sisäiseksi tai hostiin synkronoitavaksi tilaksi.

## Vastaanotettujen designien sovitus

| Aihe | Keskustelureferenssi | Workspace-referenssi | Tuotantoratkaisu ja perustelu |
|---|---|---|---|
| Teema | yhteiset vaalea/tumma-tokenit | vaatii molemmat teemat | Vaalea ja tumma ovat v1:n yhtä tuettuja teemoja. Oletus seuraa `prefers-color-scheme`a. Käyttäjä voi valita Järjestelmä/Vaalea/Tumma käyttäjävalikosta; laitekohtainen ei-sensitiivinen valinta saa olla `localStorage`ssa. Teema ei kuulu host-snapshotiin. |
| Värit | `--ah-*`-tokenit | samat arvot eri nimillä sekä `rail`/`scrim` | `tokens/` on ainoa lähde. Yhteiset `--ah-rail`- ja `--ah-scrim`-tokenit säilyttävät workspace-toimituksen pinnat ilman näkymäkohtaista arvoa. Tilaa ei ilmaista vain värillä. |
| Typografia | väljä sisältöasteikko, 70ch | tiiviimpi navigaatioasteikko | Keskustelu käyttää nykyisiä body/code-tokeneita ja enintään 70ch lukumittaa. Navigaatio käyttää meta/ui/title-tasoja, ei omaa rinnakkaista asteikkoa. Tekniset tunnisteet ovat monospacella ja kääntämättä. Fontit paketoidaan tuotteen kanssa; tuotanto ei lataa niitä kolmannen osapuolen ajonaikaisesta URL:sta. |
| Välistys | 4–36 px nimetty asteikko | 4 px ruudukko, myös 9/14 px | Nykyinen `--ah-s1…s8` on yhteinen asteikko. Uudet komponentit käyttävät nimettyjä tokeneita; vedoksen yksittäiset mitat ovat sommittelureferenssejä, eivät uusia tokeneita. |
| Liike | 380–900 ms ja vaakasiirtymä | 160–200 ms ja pieni pystysiirtymä | Yhteiset tokenit on korjattu 160–180 ms tilanvaihtoihin ja pieneen pystysiirtymään; jatkuva pulssi vain aidosti running/reconnecting-tilassa. Sisältö ei liu'u lukusuunnassa. Reduced motion poistaa pulssin ja siirtymän mutta säilyttää tekstin ja tilamerkin. |
| Agenttirivi | ei määritelty | tila saattoi jäädä pisteeseen/hoveriin | Rivi näyttää aina tekstin “Odottaa vastaustasi”, “Työskentelee”, “Odottaa viestiä”, “Ei käynnissä”, “Vain luku” tai “Tila ei tiedossa”. Piste on toisteinen. Huomiomerkki on tekstinä ja määränä. |
| Otsikko | ehdotti ennalta määrättyjä uudelleengenerointikohtia | “Uusi keskustelu”, sitten synopsis | Hostin `title.display/source/generation_state` ratkaisee näytön. UI ei kovakoodaa viestinumeroita. Manuaalinen “Luo otsikko uudelleen” näkyy vain tuetulla capabilityllä. Epäonnistuminen säilyttää edellisen otsikon/fallbackin. |
| Jono | luonnos-API ehdotti yksittäisen rivin perumista | ei määritelty | Näytetään erilliset steer- ja follow-up-jonot lähdejärjestyksessä. Vain “Tyhjennä koko jono” on toiminto; yksittäistä perumista tai reorderia ei näytetä. Editorille palautetaan vain hostin todistamat todella poistetut tekstit. |
| Fokus | vaihtui jokaisesta agenttipäivityksestä | fokus aina agentin vaihtuessa | Fokus editoriin vain käyttäjän valinnasta tai onnistuneesta create/start/resume-toiminnosta. Taustatapahtuma, unarchive yksin, title-event, reconnect tai listan uudelleenjärjestys ei siirrä fokusta. |
| Yhteys | keskustelubanneri | app-tason palkki | Yksi `ConnectionBanner` koko sovelluskehyksen yläreunassa. Keskustelun `ControlNotice` selittää agenttikohtaisen eston. Sama virhe ei toistu toastina. |
| Host-operaatio | ei kata | simuloitu onnistui/epäonnistui | `OperationProgress` näyttää sopimuksen vaiheet ja vaikutukset. Peruuta sulkee dialogin vain ennen hyväksyntää; hyväksynnän jälkeen se ei lupaa perua natiivioperaatiota. |
| GitHub | yksinkertainen linked-boolean | selainkytkentä ja yhdistetty create/push | UI näyttää capabilityn tuntemattomana tai estettynä, kun adapteria/credential-flow'ta ei ole todennettu. Remote create, origin, transport ja push ovat eri vaiheita; mitään selainkytkentää ei keksitä. |

Nykyiset `.jsx`, `.d.ts`, `.prompt.md` ja kortti-HTML:t säilyvät v0.1-referensseinä.
Niiden `onCancelQueued`, hoveriin sidottu tieto, hard-coded title cadence tai muu
yllä korjattu rajapinta ei ole tuotantosopimus.

## Visuaalinen perusta

### Värit ja kontrasti

`styles.css` on ainoa tokenien sisääntulo. Vaalean ja tumman teeman nykyiset
tekstiparit ylittävät WCAG AA:n normaalille tekstille: heikoin tarkistettu pari on
vaalean ensisijainen painike (`#fff` / `#2b7f8c`) 4,65:1. Fokus, valinta,
virhe, pending, unknown ja stale tarvitsevat aina myös tekstin, kuvion tai
muodon. Statusdot, diffitausta tai reunaväri ei yksin kanna merkitystä.

Fokusrengas on vähintään 2 px, offset 2 px, ja näkyy `:focus-visible`-tilassa
sekä vaalealla että tummalla pinnalla. Valitulla rivillä on lisäksi semanttinen
`aria-current` tai `aria-selected` ja lihavoitu/tekstuaalinen tila. Linkit ovat
alleviivattuja leipätekstissä. Danger-väri varataan virheelle ja tuhoavalle
toiminnolle, ei tavalliselle arkistoinnille.

### Tiheys, leveys ja pitkä sisältö

Pääkehys täyttää viewportin; rail on avattuna noin 296 px ja kutistettuna 46 px.
Keskustelun lukupalsta on enintään 960 px, tekstimitta enintään 70ch. Dialogin
leveys määräytyy sisällöstä 440–720 px; vaiheistetut operaatiot käyttävät leveää
versiota. UI:n pitää kestää 200 % browser zoom ilman vaakasuuntaista peittoa
1280 px desktop-viewportissa.

Nimet saavat rivittyä dialogeissa ja otsikon lisätiedoissa. Navigaation nimi
lyhenee ellipsillä vasta, kun koko nimi on saavutettavassa nimessä ja saatavilla
fokuksella (ei vain hoverilla). Virheviesti rivittyy; correlation-ID pysyy omalla
kopioitavalla monorivillään. Suomen yhdysanat, 160 merkin otsikko, 255 merkin
workspace-nimi, 10 000 merkin Taskfleet-tehtävä ja 65 536 tavun sisältöpala eivät
saa levittää layoutia.

### Liike

Liike tukee sijaintia, ei ilmoita onnistumisesta yksin. Running-piste saa sykkiä;
pending-painike käyttää lisäksi tekstiä. Uuden sisältörivin ilmestyminen ei
animoi koko timelinea. `prefers-reduced-motion: reduce` poistaa pulssin,
smooth-scrollin ja transformit. Uuteen sisältöön siirtyminen on silloin välitön
ja fokus/scroll-ankkuri kertoo muutoksen.

## Sovelluskehys ja semantiikka

Rakenne on järjestyksessä:

1. skip-linkki “Siirry keskusteluun”;
2. app-tason yhteys-/auth-banneri (`status`, virheessä `alert` kerran);
3. rail-navigaatio (`nav`, nimi “Workspacet ja agentit”);
4. valitun agentin `main` (`h1` on keskustelun otsikko);
5. overlay-juuri dialogeille ja valikoille;
6. yksi toast-region ei-kriittisille kuittauksille.

Railin workspace on otsikko + semanttinen disclosure-painike + agenttilista.
Agentit ovat yksi nuolinäppäimin toimiva collection/listbox vain, jos React Aria
-toteutus säilyttää tavallisen linkin reittisemantiikan; muuten ne ovat nav-linkkejä
DOM-järjestyksessä. Reitin avaaminen toimii Enterillä, eikä Space scrollaa jos se
on sidottu valintaan. Taustalla muuttuva kiireellisyys ei muuta fokusoidun rivin
paikkaa. Uudelleenjärjestys odottaa aina, kunnes fokus poistuu listasta; tuore
snapshot ei ohita tätä. Muutos ilmoitetaan tiivistetysti.

Yläpalkissa h1, status-teksti, workspace-linkki ja “Lisätiedot”-disclosure.
Tekniset faktat ovat `dl`:ssä. Tuntematon arvo on “Ei tiedossa”, unsupported on
“Ei tuettu”; niitä ei yhdistetä.

## Reitit, valinta ja deep linkit

Kanoniset UI-reitit ovat:

| Reitti | Näyttö |
|---|---|
| `/` | kirjautuminen tai kirjautuneena tälle `(origin, web_identity_id)`-parille viimeksi kelvollinen paikallinen reitti; ilman sitä ensimmäinen näkyvä workspace, mutta agenttia ei resumoidu |
| `/workspaces` | workspace-lista ilman agenttivalintaa; pääalueella valintaohje/empty/error |
| `/workspaces/:workspaceId` | workspacen yhteenveto ja agenttilista |
| `/workspaces/:workspaceId/agents/:agentId` | keskustelu ja natiivi historia |
| `/workspaces/:workspaceId/archive` | arkistodialogiin deep linkittyvä workspace-näkymä |
| `/operations/:operationId` | snapshotissa yhä olevan operaation tulos nykyisen valinnan päällä tai itsenäisenä palautumisnäkymänä; poissaolo ei tarkoita onnistumista |

ID:t URL-enkoodataan; basenamea, näyttönimeä, Unix-tunnusta tai absoluuttista
polkua ei käytetä identiteettinä. Dialogit, joiden pitää kestää reload tai joiden
operation-ID voi valmistua myöhemmin, ovat reititettyjä. Pienet valikot ja
lisätiedot eivät ole.

Deep link odottaa autentikointia ja ensimmäistä snapshotia ennen “puuttuu”-päätöstä.
Ennen kirjautumista pyydetty same-origin UI-polku säilytetään OIDC-paluukohteena
hostin hyväksymällä tavalla ja voittaa viimeksi käytetyn reitin; API-, auth- ja
events-polku ei kelpaa paluukohteeksi. Viime reitti tallennetaan vasta tunnistetulle
`(origin, web_identity_id)`-parille eikä sitä näytetä toiselle identiteetille.
Jos workspace tai agentti:

- löytyy: valinta avautuu ilman startia/resumea;
- on `presence:absent` tuoreessa snapshotissa: näytä “Kohdetta ei enää löydy”,
  linkki workspaceen tai `/workspaces`; älä korvaa reittiä hiljaa;
- ei löydy mutta lähde on unknown/unavailable/stale: säilytä URL ja näytä
  uudelleenlataus/reconnect; älä väitä poistoa;
- vaihtuu ulkoisesti: säilytä luonnos agenttiavaimella, ilmoita muutos, älä siirrä
  fokus­ta;
- kuuluu eri workspace-ID:lle kuin URL:ssä: näytä ristiriita ja tarjoa kanoninen
  agenttilinkki vasta tuoreesta snapshotista.

Workspaceen palaaminen säilyttää agentin reitin selainhistoriassa. Agentin
valinta on tavallinen linkkinavigaatio, joten Back palauttaa edellisen valinnan.
Workspace→Taskfleet-agentti -luonnin onnistunut `created.agent_id` vie luodun
workspacen/agentin kanoniselle reitille vasta kun snapshot vahvistaa kohteen.

## Luonnos, otsikko ja lukukohta

Draft-key on `(server origin, web_identity_id, agent_id)`. Luonnos tallennetaan
`sessionStorage`en tekstinä reloadia varten ja peilataan editoriin sen ollessa
mountattuna. Agentin vaihto ei tyhjennä sitä. Ennen command dispatchia sama
repository tallentaa keskeneräisen kuitin: `client_command_id`, kind, agent ID,
lähetetty tekstiversio, tekstin hash ja lähetysaika. Reload palauttaa kuitin,
hakee sen command-ID:llä tuoreen snapshotin jälkeen eikä salli saman tekstiversion
lähetystä ennen kuin acceptance on ratkaistu tai UncertainCommandCard on näkyvissä.
Vain saman komennon todistettu `acceptance:accepted` tyhjentää lähetetyn version;
uudempi editorimuutos säilyy. Rejected ja uncertain säilyttävät tekstin. Logout,
session identity change tai identity-clearing failure estää uuden identiteetin
sisällön näyttämisen, kunnes vanha tila on varmasti poistettu. Tabin sulkemisen
jälkeistä palautusta ei luvata; silloin server-ledger ja natiivi snapshot ovat
ainoat lähteet, eikä UI saa väittää vanhan command ID:n tulosta.

Otsikko näyttää aina hostin `title.display`-arvon. `pending` lisää tekstin
“Luodaan otsikkoa”; `failed` näyttää ei-estävän selitteen vain valikossa tai
operaatiotuloksessa ja säilyttää displayn; `unknown` ei näytä spinneriä.
“Luo otsikko uudelleen” lähettää uuden komennon vain capabilityn ollessa
`supported`; unknown/unsupported-syy näkyy valikossa.

Lukupaikan ankkuri on ensimmäinen kokonaan tai osittain näkyvä pysyvä
`native_key` + sen pixel-offset. Live-deltan transientti event-ID ei ole pysyvä
ankkuri. Snapshotin vaihtuessa ankkuri palautetaan vain, jos avain löytyy; muuten
lähin edeltävä pysyvä entry valitaan ja käyttäjälle kerrotaan “Lukukohtaa ei voitu
palauttaa täsmälleen”. Auto-scroll tapahtuu vain, kun käyttäjä oli pohjassa ennen
päivitystä. Muuten “Uutta sisältöä (N)” pysyy näkyvänä ja vie pohjaan ilman
fokuksen kaappausta; aktivointi siirtää fokuksen viimeisimmän kokonaisen entryn
otsikkoon.

## Timeline, streaming ja virtualisointi

DOM-järjestys on aina kronologinen. UserMessage, AssistantMessage, ToolGroup,
SupportedQuestion, turn error ja unknown event ovat timeline-itemeitä. Markdown
on semanttista HTML:ää, mutta raw HTML ei suoritu. Koodi ja output säilyttävät
valinnan; selainhaun ja kopioinnin pitää toimia näkyvään sisältöön.

Streamingissä agenttiviestin näkyvä sisältö voi päivittyä usein, mutta live region
ei lue token-deltaa. Käytä yhtä kohteliasta (`aria-live=polite`, `aria-atomic=true`)
yhteenvetoaluetta:

- korkeintaan kerran 5 sekunnissa: “Pi vastaa” tai “Työkalu käynnissä” ilman
  sisältötekstin toistoa;
- heti merkityksellisellä rajalla: kysymys odottaa, vuoro keskeytettiin,
  vuoro epäonnistui tai agentti asettui;
- yhdistä saman 2 sekunnin jakson tapahtumat yhdeksi ilmoitukseksi;
- app-tason yhteysvirhe ilmoitetaan kerran, ei jokaisesta retry-yrityksestä.

Virtualisointi on suorituskykyoptimointi, ei saavutettavuusmalli. Näppäimistö- tai
ruudunlukijakäyttäjä voi valita “Näytä saavutettava sivutettu historia”, joka
renderöi enintään 200 entryä kerrallaan hostin history-sivujen mukaan ja tarjoaa
“Vanhemmat”/“Uudemmat”. Asetus on tämän tabin UI-tila. Virtualisoidussa tilassa
fokusoitua itemiä ei unmountata, mittaus säilyttää ankkurin ja selaimen haku
kertoo hakevansa vain ladatusta historiasta. “Lataa vanhempaa” säilyttää nykyisen
ankkurin. Jos aktiivinen `live_tail` on unavailable, timeline näyttää estävän
lähdevirheen eikä vajaata aktiivista vuoroa.

### Valinta ja kopiointi

Tekstin maalaaminen ei laukaise rivin avausta, navigointia tai drag-toimintoa.
Kaikki transcriptin teksti on valittavissa. Koko viestin “Kopioi” kopioi
lähdetekstin ilman puhujalabelia, aikaa tai tilamerkkejä. CodeBlock kopioi koodin;
DiffView kopioi yhtenäisen unified diff -tekstin merkkeineen; ToolOutput kopioi
vain näkyvän palan ja kertoo, jos lähde jatkuu. Kopiointipalaute on “Kopioitu”
statusalueessa, ei pelkkä ikonimuutos. Clipboard-virhe jättää valinnan ja näyttää
“Tekstiä ei voitu kopioida”.

## Composer, jono ja epävarma komento

Composerin editori on nimetty monirivinen kenttä. `Enter` lähettää valitulla
tavalla, `Shift+Enter` tekee rivinvaihdon; IME composition ei lähetä.
`Ctrl/Cmd+Enter` lähettää idle-agentille tavallisen viestin ja working-agentille
valitulla steer/follow-up-tavalla. Työskentelevälle agentille lähetyspainikkeen
valikko tarjoaa täsmälleen:

- “Ohjaa tämän vuoron jälkeen” (`agent.steer`);
- “Suorita valmistumisen jälkeen” (`agent.follow_up`).

Viimeksi käyttäjän valitsema työskentelytapa säilyy tabin agenttikohtaisessa
UI-mallissa. Kun jono tyhjenee, oletus on follow-up, kunnes käyttäjä valitsee
sen jälkeen toisin. Teksti kertoo, ettei steer keskeytä käynnissä olevaa työkalua.
QueuePanel näyttää kaksi nimettyä ryhmää ja lähteen järjestyksen. “Tyhjennä koko
jono” on dangeria lievempi vahvistus. Editorille palautetaan vain hostin clear-
rajalla todella poistamiksi vahvistamat tekstit oikeissa ryhmissä/järjestyksessä;
precondition-snapshotista arvattuja tekstejä ei palauteta. V1-sopimus ei vielä
kuljeta tätä tulosta, joten clear pysyy disabled syyllä, kunnes adapteri todistaa
poistetut tekstit tai sopimus täsmentyy. `stale_precondition` ei palauta mitään.
Yksittäisellä rivillä ei ole cancelia.

CommandReceipt erottaa:

- **Lähetetään**: local pending, nappi estetty kaksoispainallukselta;
- **Hyväksytty**: acceptance accepted; editorin lähetetty versio tyhjennetään;
- **Hylätty**: syy ja korjaus, ei automaattista retryä;
- **Tulos epävarma**: alkuperäinen teksti, command ID:n lyhyt näyttö/kopiointi,
  “Tarkista tila” (fresh snapshot + query sovelluksen kautta), “Kopioi teksti” ja
  “Lähetä uutena…”;
- **Lähetä uutena**: vahvistus sanoo, että sama viesti voi toteutua kahdesti ja
  luo uuden command ID:n. Se ei ole retry-painike.

Katkos, stale snapshot, resnapshot, auth expiry, read-only control ja capability
unknown estävät kirjoituksen sanallisella syyllä. Disabled control säilyy näkyvänä,
kun siitä opitaan mitä puuttuu; action jätetään kokonaan pois vain, jos se ei kuulu
kyseiseen resurssiin (esimerkiksi manuaalisen worktreen hallinta).

## Agentin tila, kysymykset ja TUI-siirto

Historia, prosessi, control, activity ja capability näytetään erillisinä riveinä
lisätiedoissa. UI ei yhdistä `not_observed`-arvoa päättyneeksi. Päätoiminto:

- `control:owned`: viesti/jono/keskeytys capabilityittäin;
- `confirmed_exited` + resume supported: “Resumoi keskustelu”;
- `terminal_observed_live` + `transfer_possible`: historia read-only ja
  “Siirrä selaimen ohjaukseen”;
- `read_only`, `unknown`, `unavailable`, stale tai not_observed: vain historia ja
  täsmällinen estosyy.

TransferDialog näyttää vaiheet stop known owner **tai** käyttäjän terminaaliohje,
process exit, history settlement, writer lock ja RPC start. Se ei tarjoa selaimen
TUI-attachia eikä signaalia havaitulle PID:lle. Sulkeminen ei väitä operaatiota
perutuksi. Epäselvä vaihe pysyy unknownina ja estää jatkon.

SupportedQuestion renderöi vain sopimuksen `input`, `confirm` ja `select`-tyypit.
Prompt on otsikko, requestin tila näkyy ja response lähetetään request-ID:llä.
Inputissa on vapaa tekstikenttä; confirmissa “Kyllä”/“Ei”; selectissä yksi
semanttinen valinta. Input/select tarjoaa “Peruuta pyyntö” -intentin, joka käyttää
`response:null`-arvoa vasta kun adapterin mapping natiiviin cancellationiin on
todennettu; siihen asti kontrolli on disabled syyllä. Pending estää uuden
vastauksen. `question.resolved` sulkee kontrollit ja näyttää outcome-tekstin
“Vastattu”, “Peruttu”, “Vanhentunut” tai “Käsiteltiin toisessa näkymässä”.
Tuntematon kysymystyyppi on read-only generic event, ei arvattu lomake.

## Dialogit, valikot ja fokus

V1 käyttää Dialog-, AlertDialog-, Menu-, Tabs-, TextField-, Checkbox-, RadioGroup-
ja Select-peruskomponentteja katalogin mukaan. Dialogin avaus:

1. tallentaa avaavan kontrollin;
2. siirtää fokuksen otsikkoon tai ensimmäiseen virheelliseen kenttään, ei aina
   ensimmäiseen syötteeseen;
3. trapittaa Tab-järjestyksen ja piilottaa taustan accessibility treestä;
4. käyttää Escissä samaa `closeAvailability`-sääntöä kuin näkyvä Sulje-painike;
   hyväksytyn pitkäoperaation esityksen saa sulkea tekstillä “Sulje näkymä —
   operaatio jatkuu”, mutta local acceptance-pending -hetkellä sulku voi olla estetty;
5. palauttaa fokuksen avaajaan; jos avaaja katosi, workspace-otsikkoon tai railin
   kanoniseen linkkiin.

Valikko palauttaa fokuksen laukaisimeen. Nuolinäppäimet liikkuvat itemeissä,
Home/End reunoille, Esc sulkee. Disabled item ei ole ainoa tapa kertoa syytä:
se sisältää lyhyen syyn tai viittaa vieressä näkyvään tekstiin. Oikotiet eivät
laukea dialogissa paitsi Esc. Mac näyttää ⌘ ja muut alustat Ctrl; saavutettava
nimi sanoo toiminnon, ei symbolia.

Globaalit oikotiet ovat `Cmd/Ctrl+K` railin suodattimeen ja `Cmd/Ctrl+B` railin
avaus/sulku. Uudelle agentille ei varata selainten `Cmd/Ctrl+N`-yhdistelmää;
toiminto löytyy näkyvästi workspace-otsikosta. Edellinen/seuraava agentti on
`Cmd/Ctrl+ArrowUp/Down` vain, kun fokus ei ole tekstikentässä, editorissa tai
muussa natiivissa muokkauskontrollissa. Oikotie ei laukea IME compositionissa
tai dialogissa eikä kun selaimen/ruudunlukijan varattu yhdistelmä estää sen;
kaikki toiminnot löytyvät myös näkyvistä kontrolleista.

## Host-operaatiot ja lomakkeet

Kaikki workspace-, Git-, GitHub-, Taskfleet-, arkisto- ja poistovirrat koostuvat
ProductDialogista, tavallisista kentistä, CapabilityNotice-komponentista ja
OperationProgressista. Kenttävirhe liittyy `aria-describedby`llä sekä kenttään
että dialogin virheyhteenvetoon. Serverin vapaa virheteksti on redaktoitu lähteessä,
mutta UI käsittelee sen silti epäluotettuna tekstinä.

### Workspace ja Git

CreateWorkspaceDialogissa valitaan “Tyhjä workspace” tai “Git-workspace”; nimi
on todellinen suora basename, näyttönimi on valinnainen erillinen kenttä. Tämä
korjaa vedoksen väitteen, ettei hakemistosta puhuta: sopimus vaatii turvallisen
nimen ja käyttäjän pitää ymmärtää levylle syntyvä kohde. Create onnistuu vasta
vahvistetusta effectistä; automaattinen agent start on myöhempi erillinen vaihe,
ja fokus siirtyy vasta `created.agent_id`:n vahvistuttua.

Git-workspacen avaaminen näyttää blocking GitIntegrationDialogin, kun integraation
capability/fakta sitä vaatii. Repository, remote, credential transport,
permission, network ja tavallinen pull/push-readiness näkyvät omina vaiheinaan.
Unknown ei saa vihreää checkiä. Dialogi ei tarjoa browser credential -flow'ta,
kun capability ei sitä tarjoa.

WorkspaceSettingsDialog muuttaa display namea yhdellä Save-komennolla. Näkyvyyden
“Piilota/Palauta” on erillinen välittömästi vahvistettava komento omalla
CommandReceiptillä; se ei kuulu display-name-tallennukseen. Valitun workspacen
piilottaminen säilyttää nykyisen reitin ja näyttää ilmoituksen, mutta poistaa sen
railin normaalilistasta. Git init on kolmas erillinen komento. Git-faktat ovat
read-only. Symlinkki tai unknown kind näkyy listassa, mutta mutation controls
ovat read-only syineen.

### GitHub ja Taskfleet

GitHubCreateDialog kysyy ownerin, repon, visibilityn ja hostin vaatiman
confirmationin. V1-sopimus ei vielä määritä confirmationin odotettua arvoa tai
vertailua, joten submit pysyy estettynä capability-syyllä, kunnes host palauttaa
validoitavan confirmation challengen tai sopimus täsmentyy; UI ei lainaa deleten
nimivahvistusta. Remote create, origin, transport check ja push näkyvät vaiheina.
CloneDialog kysyy exact `owner/repo`, target namen ja transportin; osittainen
hakemisto jää näkyväksi failed/incomplete-workspacena. Capability unknown näyttää
“GitHub-toimintoa ei ole vielä todennettu tällä palvelimella”; se ei tarjoa
“Yhdistä tili” -mockia.

TaskfleetWorktreeDialog kysyy source branchin, title-arvon ja taskin kuten
v1-sopimus. UI ei lupaa branchin olevan title tai käyttäjän antama nimi; Taskfleet
raportoi lopullisen branchin. Toiminto näkyy vain Git main workspacelle ja
supported capabilityllä. Manual/unknown linked worktree on vaikutus, ei
hallittava resurssi.

### Arkisto ja poisto

Arkistointi aktiiviselle writerille ei yhdistä stop+archivea yhdeksi piilotetuksi
napiksi. “Lopeta prosessi” on erillinen komento, jonka jälkeen “Arkistoi” tulee
mahdolliseksi. ArchiveDialog listaa natiivihistoriasta johdetut keskustelut;
“Jatka” unarchiveaa ja resumoi erillisinä näkyvinä vaiheina samalla agent-ID:llä.
Unarchive ei yksin siirrä fokusta read-only-editoriin; fokus siirtyy vasta resumen
vahvistettua `control:owned`-tilan. Puuttuva annotaatio ei tarkoita puuttuvaa historiaa.

DeleteWorkspaceDialog näyttää preflightin prosessit, Taskfleet-run ownershipit,
kaikki linked worktreet myös `~/src`:n ulkopuolelta, mount/unknown-vaikutukset ja
kohteen nimen. Käyttäjä kirjoittaa täsmälleen `workspace.name`-arvon ilman trimmausta;
näyttönimi ei kelpaa. AlertDialogin ensifokus on “Peruuta”, ei delete. Toiminto
estyy observed/unowned-prosessista, manuaalisesta worktreestä, symlinkistä tai
unknown-vaikutuksesta. “Piilota sen sijaan” on erillinen turvallinen toiminto.
Valmis näkyy vasta `source_reobserved` + directory absent -näytöllä. Partial jää
operation-reitille ja luettelee residual-vaikutukset.

## Yhteys, auth, virheet ja ilmoitukset

ConnectionBannerin tilat ovat loading, online (ei pysyvää banneria), reconnecting,
stale, resnapshot-required, authentication-required, daemon-unavailable ja
host-read-only. Snapshotin `write_state:read_only` näyttää terveen yhteyden
rinnalla “Palvelin on vain luku -tilassa” ja estää kaikki mutaatiot; sitä ei
kutsuta staleksi. Stale sisältö säilyy luettavana ja merkitään “Viimeksi saatu
{aika}”; kaikki kirjoitukset estyvät. Reconnect/backoff ei näytä sekuntikelloa
eikä hidden retryä.
Käyttäjän “Yritä uudelleen” pyytää controlleria uuteen havaintoon, ei toista
viime komentoa.

ToastRegion on `role=status`, kohtelias ja yksi viesti kerrallaan. Se sopii
kopiointiin, tallennettuun näyttönimeen ja yhteyden palautumiseen. Error/partial,
uncertain send, auth expiry, kysymys ja destructive confirmation ovat pysyviä
inline-tiloja tai dialogeja, eivät katoavia toasteja. In-app attention päivittyy
railin lukuna, agenttirivin tekstillä “Odottaa vastaustasi” ja dokumentin
otsikolla “(N) Native Agent Host”. Count-muutos ilmoitetaan korkeintaan kerran
kahdessa sekunnissa, ja nykyinen agentti ei saa huomiomerkkiä vain saapuvasta
deltasta.

## Tilojen yhteinen sanasto

Jokainen tietoa tai toimintoa näyttävä komponentti tukee vain sille tarpeelliset
tilat:

- `loading`: ensimmäistä lähdetietoa ei ole;
- `pending/running`: hyväksyntä tai työ on kesken;
- `disabled`: toiminto ei ole käytettävissä ja syy tunnetaan;
- `read_only`: sisältöä voi lukea, mutta kontrollia ei ole;
- `empty`: onnistunut havainto, jossa lista on tyhjä;
- `error/failed`: tunnettu epäonnistuminen;
- `stale`: vanha data näkyy, uutta ei ole vahvistettu;
- `unknown`: lähde ei voi ratkaista tilaa;
- `partial`: osa vaikutuksista toteutui;
- `unsupported`: adapteri tai resurssi ei tarjoa toimintoa.

Emptyä ei näytetä loading-, unavailable-, unknown- tai error-tilasta. Pending ei
muutu succeedediksi pelkästä HTTP 202:sta. Unknown ei saa retryä ennen tuoretta
havaintoa. Partial ei saa “Kumottu”-tekstiä ilman rollback-näyttöä.

## Toteutuksessa todennettava

Tämä design ei ratkaise seuraavia avoimia adapteri-/proof-kohtia:

- one-off Pi -otsikkokutsun mekanismi, malli, kustannusraja ja milestone-trigger;
- terminal operation -retention tai operation query: jos deep linkin ID puuttuu
  snapshotista, UI sanoo “Operaation tulosta ei ole enää saatavilla — tarkista
  kohteen tila tuoreesta havainnosta”, eikä päättele onnistumista;
- `agent.queue.clear`-tuloksen täsmälliset todella poistetut tekstit ja järjestys;
  ennen tätä clear ei saa palauttaa pre-snapshotista arvattuja rivejä editoriin;
- GitHub-create confirmation challenge ja question-cancelin null→native-mapping;
- GitHub credential UX sekä luvallinen create/push/clone/delete-koe molemmille
  käyttäjille;
- Taskfleet create/partial teardown -adapteri ja capability;
- prosessi-, tmux-, mount- ja worktree-havaintojen kattavuus;
- variable-height-virtualisoinnin ankkuri ja saavutettava fallback oikealla
  ruudunlukijalla;
- pitkän historian, outputin ja event-ring/ledger-rajojen pilotin budjetit;
- Proposed ADR 0002:n komponenttikirjasto ja Proposed ADR 0003:n host-stack.

Unknown/unsupported-tila on näissä valmis design-tulos. Se ei ole lupa muuttaa
sopimusta, piilottaa hyväksyttyä MVP-toimintoa tai hyväksyä Proposed ADR:ää.
