# Komponenttikatalogin sopimus v1

Tämä katalogi määrittää tuotannon rajatun komponenttijoukon. Propsit ovat
tuotetermejä ja framework-riippumattomia. [ADR 0002](../docs/adr-0002-frontend-stack.md)
on hyväksytty, ja ensimmäinen React/React Aria -toteutus on
`web/src/components/`-hakemistossa.

Tuotantokomponenttien catalog-storyt tuovat samat toteutusmoduulit kuin sovellus.
Ne kattavat pitkän suomenkielisen sisällön, keyboard/focus-, dark-, 200 % zoom-
ja reduced motion -esimerkit sekä alla nimetyt tämän slicen tilat. Fixture antaa
valmiin näyttömallin; story ei sisällä omaa Pi-, verkko- tai reconciliation-
logiikkaa. Myöhemmät journey-slicet täydentävät samassa katalogissa ne komponentit
ja integraatiot, jotka tarvitsevat oikean host-sopimuksen näyttömallin.

## Sopimusmuodot

Alla olevat pseudo-tyypit ovat dokumentaatiota, eivät TypeScript-lähde. Yhteiset
muodot:

```text
AsyncState = idle | loading | pending | ready | empty | error | stale | unknown
Availability = enabled | disabled(reason) | read_only(reason) |
               unsupported(reason) | unknown(reason)
Intent<T> = käyttäjän tapahtuma T; ei HTTP-kutsu eikä domain-päätös
ProblemView = { title, description?, code?, correlationId?, retryKind }
RetryKind = none | reobserve | reauthenticate | deliberateNewCommand
SourceStatus = confirmed | absent | unknown | unavailable | conflicting
```

Komponentit eivät vastaanota bearer-tokenia, CSRF-tokenia, credentialia,
absoluuttista home-polkuun sidottua routing-avainta tai raakaa HTML:ää. Stable
ID:t ovat opaqueja. Kaikki `reason`, `description`, model-output ja tool-output
renderöidään tekstinä tai sanitisoidun Markdown-rajan läpi.

## 1. Yleiset primitiivit

Käytä natiivia HTML:ää, kun se antaa koko käytöksen. Composite controls,
overlayt, collectionit ja fokus tarvitsevat hyväksytyn saavutettavan
behavior-pohjan. Älä tee yleistä layout-, grid-, avatar-, tooltip- tai data-table-
kirjastoa varalta.

### Button

```text
Button {
  label, variant: primary | secondary | quiet | danger,
  size: compact | normal, availability, pending?, shortcutHint?,
  onPress: Intent<press>
}
```

Natiivi button. Pending säilyttää labelin (“Tallennetaan…”) ja estää toiston.
Disabled reason näkyy vieressä tai `ControlReason`issa, ei pelkässä tooltipissä.
Danger ei ole oletusfokus. Icon-only sallitaan vain railin collapse/copy-tyyppiseen
tuttuun toimintoon, ja sillä on accessible name sekä 44×44 tavoitealue.

### Link ja NavLink

```text
Link { label, href, external?, current? }
NavLink { label, href, current: page | false, badgeText?, statusText? }
```

Oikea `<a>` säilyttää deep linkin, selaimen historian ja copy-link-toiminnan.
External-linkki kertoo uudesta kohteesta saavutettavassa nimessä ja käyttää
sallittua URL-skeemaa. Agenttirivi koostetaan NavLinkistä, ei click-divistä.

### TextField, TextArea ja SearchField

```text
TextField { label, value, hint?, required?, error?, mono?, availability,
            autocomplete?, onChange, onCommit? }
TextArea  { ...TextField, rows?, maxLength?, submitBehavior? }
SearchField { label, value, resultSummary, onChange, onClear }
```

Label on aina näkyvä paitsi railin tiiviissä searchissa, jossa visually-hidden
label on “Suodata workspaceja ja agentteja”. Hint, error ja char count liittyvät
`aria-describedby`llä. Whitespacea tai kirjainkokoa ei muuteta huomaamatta.
Delete confirmation käyttää monoa eikä trimmaa. TextArea kertoo Enter/Shift+Enter-
käytöksen; IME-composition ei committoi.

### Checkbox, RadioGroup ja Select

```text
Checkbox { label, checked, hint?, availability, onChange }
RadioGroup<T> { label, value, options[{value,label,description?,availability}], onChange }
Select<T> { label, value, options[{value,label,description?,availability}], onChange }
```

RadioGroup on ensisijainen enintään viidelle toisensa poissulkevalle näkyvälle
valinnalle (teema, visibility, transport). Select on branch-/owner-listalle.
Placeholder ei ole kelvollinen valinta. Disabled option kertoo syyn tekstinä.

### Dialog ja AlertDialog

```text
Dialog { title, description?, size, closeAvailability, initialFocus,
         returnFocusRef, children, onRequestClose }
AlertDialog { ...Dialog, severity, confirmationControl,
              cancelLabel, actionLabel, actionAvailability, onConfirm }
```

Dialog omistaa vain overlayn, focus trapin ja close-intentin. Feature omistaa
kentät ja komennon. AlertDialogia käytetään workspace-deleteen ja epävarman
viestin tietoiseen uuslähetykseen. Fokus avattaessa otsikkoon/virheeseen;
tuhoavassa vahvistuksessa Peruuta-painikkeeseen. Esc ja näkyvä Sulje käyttävät
samaa `closeAvailability`a. Hyväksytyn pitkäoperaation sulkeminen tekstillä
“Sulje näkymä — operaatio jatkuu” sulkee esityksen, ei peru operaatiota.

### Menu, Tabs ja Disclosure

```text
Menu { label, items[{id,label,description?,availability,danger?}], onAction }
Tabs<T> { label, selected, tabs[{id,label,panel}], onChange }
Disclosure { label, expanded, summary?, onToggle, children }
```

Menu on tilapäisille komennoille, Tabs vain “Luo uusi” / “Hae GitHubista” -tyyppiseen
samassa dialogissa vaihtuvaan sisältöön. Se ei ole reititys. Disclosure on
workspace-, tool- ja details-avaukselle. Kaikissa näkyy tekstilabel, ei pelkkä
chevron.

### StatusMark, Badge ja ProgressIndicator

```text
StatusMark { label, tone: neutral | info | success | warning | danger,
             animated: false | running }
Badge { label, tone, count? }
ProgressIndicator { label, kind: indeterminate | determinate, value? }
```

StatusMark sisältää aina sanan; piste/ikoni on koristeellinen. Badge ei ole ainoa
huomiokanava. ProgressIndicator käyttää determinate-arvoa vain, jos lähde antaa
todellisen määrän; muuten label kertoo vaiheen.

### InlineNotice, ConnectionBanner, ToastRegion ja ControlReason

```text
InlineNotice { title, description?, tone, problem?, actions[] }
ConnectionBanner { state, lastConfirmedAt?, hostWriteState?, problem?, primaryAction? }
ToastRegion { message?, politeness: polite }
ControlReason { reason, relatedAction? }
```

ConnectionBanner on appissa singleton. `hostWriteState:read_only` näyttää terveen
yhteyden rinnalla oman vain luku -syyn ja estää kaikki mutaatiot; se ei ole stale.
InlineNotice säilyy niin kauan kuin tila vaatii. Toast ei kanna error-, partial-,
question- tai uncertain-tilaa.
ProblemView näyttää vapaan tekstin escapettuna, vakaan koodin ja tarvittaessa
kopioitavan correlation-ID:n.

### FormErrorSummary ja ConfirmNameField

```text
FormErrorSummary { heading, errors[{fieldId,message}] }
ConfirmNameField { expectedName, value, error?, onChange }
```

Summary fokusoidutaan epäonnistuneen submitin jälkeen ja linkit vievät kenttiin.
ConfirmNameField kertoo, että odotetaan hakemiston `name`-arvoa täsmälleen;
copy/paste sallitaan. Se ei vertaa display nameen.

## 2. Navigaatio ja sovelluskehys

### AppShell

```text
AppShell { connection, rail, main, overlays, toast, onSkipToMain }
```

Vastuu: alueiden järjestys, skip link, desktop-mitat. Ei auth-, SSE- tai route-
logiikkaa. Tilat: initial loading, authenticated, stale-readable,
authentication-required ja daemon-unavailable; sisältö annetaan lapsina.

### LoginCard

```text
LoginCard { serverName, serverAddress, state: idle|pending|partial|error,
            providers[{id,label,availability}], problem?,
            onSelectProvider, onRetry }
```

Ei Unix-käyttäjän valintaa. Ensisijainen valinta on “Kirjaudu GitHubilla”; valinnainen Google näkyy vain konfiguroituna eikä tee verkkopyyntöä ennen eksplisiittistä valintaa. Pending kattaa OAuth-callbackin, web-istunnon ja GitHub-polulla natiivin `gh` HTTPS -asennuksen. Partial/virhe kertoo turvallisesti, kumpi vaihe jäi kesken, ilman tokenia. Correlation-ID säilyy. Komponentti ei käsittele OAuth-koodia, tokenia tai Unix-reititystä.

### WorkspaceRail

```text
WorkspaceRail {
  collapsed, serverLabel, connectionLabel, attentionCount,
  filterValue, resultSummary, listState, workspaces,
  hiddenCount, createAvailability,
  onToggle, onFilter, onRefresh, onCreate, onShowHidden
}
```

Vastuu: nav-semantiikka, suodatus-UI, kokoonpano ja keyboard entry. Sovellus antaa
jo järjestetyt WorkspaceSection-mallit; rail ei päättele kiireellisyyttä tai
muuta järjestystä fokuksen alla. Tilat: loading skeleton tekstillä, ready, empty,
source absent, error, stale ja filtered-empty. `empty` vain confirmed-lähteestä.

### WorkspaceSection

```text
WorkspaceSection {
  workspaceId, name, href, expanded, summary?, mutationState,
  agents, actions[], onToggle, onAction
}
```

Nimi on linkki workspace-reitille; collapse on erillinen button. Actions sisältää
valmiit availabilityt. Symlink/unknown/read-only näkyy tekstinä. Agentiton tila
näyttää “Avaa uusi agentti”, jos capability supported, muuten syyn.

### AgentNavItem

```text
AgentNavItem {
  agentId, href, title, activityLabel, controlLabel,
  attentionLabel?, relativeTime?, selected, depth,
  presence: present|absent, stale?, onNavigate
}
```

Rivi näyttää textual activity/control-tilan eikä vain pistettä. Yksi rivi,
ellipsi vain visuaalisesti; koko nimi accessible namessa. Parent-child-depth on
visuaalinen ja listarakenteen semantiikka, ei branchista päätelty tieto.

### AgentHeader ja AgentFacts

```text
AgentHeader {
  title, titleState, activityLabel, controlLabel, workspaceLink,
  parentContext?, timestamp?, detailsExpanded,
  titleAction?: { label, availability, pending, failureNotice? },
  onToggleDetails, onTitleAction
}
AgentFacts { facts[{label,value,state,observedAt?,source?}] }
```

AgentHeader on h1 ja tuotteen status. TitleAction on otsikon vieressä oleva saavutettavasti nimetty manuaalinen regenerate-kontrolli vain supported-tilassa, disabled syy muuten. Pending estää rinnakkaisen title-komennon muuttamatta display-arvoa; failureNotice on ei-estävä eikä siirrä fokusta tai estä keskustelua. AgentFacts on `dl`; “Ei tiedossa”, “Ei saatavilla”
ja “Ristiriita” ovat eri arvot. Polku saa näkyä vain redaktoidussa display-faktassa,
ei routing-proppina.

### AttentionSummary

```text
AttentionSummary { count, label, agentLinks[], announce? }
```

Rail badge + textual summary + document-title effectille annettava malli.
Komponentti ei kutsu Notification APIa. Announcement on throttlettu ulkopuolella.

## 3. Timeline ja sisältö

### ConversationTimeline

```text
ConversationTimeline {
  state: loading|ready|empty|error|stale|unavailable,
  items, readingAnchor?, atBottom, newContentCount,
  historyMode: virtualized|pagedAccessible,
  pageNavigation?, problem?,
  onRequestOlder, onRequestNewer, onJumpToLatest,
  onAnchorChange, onHistoryModeChange
}
```

Vastuu: semanttinen feed/lista, scroll anchoring -intentit, fallbackin valinta.
Ei event-deduplikointia eikä history fetchiä. Empty näyttää “Aloita keskustelu”
vain readable empty -historialle. Stale pitää itemsit näkyvissä.

### UserMessage ja AssistantMessage

```text
UserMessage { sourceText, renderedContent, time?, deliveryState?, onCopy }
AssistantMessage { sourceText, sanitizedMarkdown, time?, streamState,
                   modelLabel?, onCopy }
streamState = streaming | complete | interrupted | failed | unknown
```

User/assistant erotetaan tekstilabeleilla. AssistantMessage ei näytä raakaa HTML:ää.
Streaming cursor on `aria-hidden`; live-region saa erillisen yhteenvedon.
Failed/interrupted säilyttää jo saadun tekstin ja näyttää lopputilan.

### MarkdownContent

```text
MarkdownContent { astOrSanitizedNodes, linkPolicy, contentState }
```

Hyväksyy vain boundaryssa validoidun/sanitisoidun render modelin, ei HTML-stringiä.
Heading-tasot suhteutetaan keskusteluun; ensimmäinen mallin otsikko on h2, ei uusi
h1. Ulkolinkki kertoo kohteen. Taulukko saa vaakavierityksen omassa alueessaan ja
caption/accessible namen. Pending sanitizer näyttää plain text fallbackin.

### CodeBlock

```text
CodeBlock {
  text, languageLabel?, sourceState: complete|continued|livePartial,
  highlightState: pending|ready|failed,
  continuation?, collapsed?, onCopy, onToggle, onLoadMore
}
```

Plain `<pre><code>` on aina toimiva fallback. Highlight ei muuta tekstiä.
`continued` näyttää näytetyt tavut/rivit ja käyttää content-ID:n sijasta sovelluksen
antamaa continuation-intentiä. Copy kertoo kopioiko näkyvän palan vai koko jo
ladatun sisällön. Pitkä sisältö alkaa collapsed mutta on avattavissa.

### DiffView

```text
DiffView {
  pathLabel, unifiedText, parsedLines?, added?, removed?,
  parseState: pending|ready|failed|unsupported,
  view: splitVisual|unifiedAccessible,
  sourceState, onCopy, onViewChange, onLoadMore
}
```

Vain Pi editin supplied patch saa diffin. Parse failure näyttää escapetun unified
textin, ei tyhjää. Add/del ilmaistaan `+`/`-`-merkillä ja screen-reader-labelilla,
ei vain taustalla. Unified accessible view on aina saatavilla.

### ToolRow, ToolGroup ja ToolOutput

```text
ToolRow { name, targetText?, statusLabel, state, durationText?, expanded,
          errorSummary?, onToggle, children }
ToolGroup { title, summaryCounts, state, expanded, containsException,
            stableGroupKey, onToggle, children }
ToolOutput { text, streamSemantics: replacement|append|unknown,
             sourceState, continuation?, onCopy, onLoadMore }
```

Sovellus muodostaa ryhmät ja replacement/append-semanticsin adapteritiedosta;
komponentti ei arvaa niitä. Suljettu ryhmä näyttää virheen/keskeytyksen ja määrän.
Unknown tool käyttää samaa ToolRow+ToolOutput-rakennetta. Expanded-state avain on
pysyvä native key vain, kun sellainen on saatavilla.

### UnknownEvent

```text
UnknownEvent { kindLabel, safeSummary, safePayloadText?, nativeKey?, onCopy }
```

Escapettu geneerinen esitys. Ei komponentin dynaamista valintaa kind-stringistä,
ei JSON:n executea eikä “onnistui”-päätelmää.

### SupportedQuestion

```text
SupportedQuestion {
  requestId, kind: input|confirm|select, prompt, choices?, value?,
  state: open|pending|answered|cancelled|expired|resolvedElsewhere|failed|unsupported,
  cancelAvailability?, problem?, onChange, onRespond, onCancel
}
```

Kontrolli muodostuu kindin mukaan. `onRespond` on intent request-ID:llä.
Input/selectin `onCancel` mapataan `response:null`-arvoon vasta todennetulla
native cancellation -mappingilla; muuten cancelAvailability kertoo syyn.
Pending lukitsee vain tämän pyynnön. Answered/cancelled/expired/resolved elsewhere
säilyvät timeline-iteminä omilla outcome-teksteillään. Unsupported ei luo
kyllä/ei-painikkeita.

### StreamAnnouncer ja NewContentControl

```text
StreamAnnouncer { summaryText }
NewContentControl { count, onActivate }
```

Announcerin throttle/batch on controller/view-modelin vastuulla; komponentti on
yksi atomic polite region. NewContentControl on button, ei floating text; siinä
on määrä ja selkeä fokus.

## 4. Composer ja komennon näkyvä tila

### Composer

```text
Composer {
  value, availability, activity: idle|working|settling,
  selectedWorkingMode: steer|follow_up,
  sendState, draftStatus?, queueSummary?,
  onChange, onSendNow, onSteer, onFollowUp,
  onModeChange, onInterrupt, onOpenQueue
}
```

Composer ei saa `onSend(mode:string)`-ohituskaistaa vaan nimetyt tuotetapahtumat.
Idle näyttää “Lähetä”; working näyttää valitun steer/follow-up-toiminnon ja sen
selityksen. Valittu mode tulee tabin agenttikohtaisesta UI-mallista ja palautuu
follow-up-oletukseen jonon tyhjennyttyä, kunnes käyttäjä valitsee toisin.
Interrupt on nykyisen vuoron keskeytys ja näkyy vain capabilityllä. Availability
reason on näkyvä. Read-only composer näyttää luonnoksen mutta ei lähetystoimintoa.
Keskeneräinen submission tallennetaan ennen dispatchia tabikohtaiseen repositoryyn
(command ID, kind, agent ID, lähetetty tekstiversio/hash ja aika); reload
reconcileoi sen ennen saman tekstin uutta lähetystä.

### QueuePanel

```text
QueuePanel {
  steeringTexts[], followUpTexts[], state: ready|pendingClear|error|stale,
  clearAvailability, onClearAll
}
```

Järjestys ja tekstit tulevat hostista. Ei per-message cancelia, reorderia tai
muokkausta. Clear confirmation kertoo, että koko jono tyhjennetään. Editorille
palautuvat vain hostin clear-rajalla todella poistamiksi vahvistamat tekstit
ryhmässä/järjestyksessä; paneli ei tallenna niitä. Koska nykyinen v1-result ei
kuljeta tätä joukkoa eikä queue-token-takuuta ole kirjattu, clearAvailability on
disabled sopimuspuutteen syyllä. `stale_precondition` ei palauta tekstiä.

### CommandReceipt ja UncertainCommandCard

```text
CommandReceipt { kindLabel, acceptance, execution, problem?, recordedAt? }
UncertainCommandCard {
  commandLabel, textPreview?, commandIdLabel, explanation,
  availability, onReconcile, onCopyText, onSendAsNew
}
```

Acceptance ja execution näytetään eri riveillä. HTTP-status ei kuulu visuaaliseen
APIin, ellei problem sisältää turvallista teknistä detailia. Reconcile pyytää
fresh observationin/queryn; se ei lähetä komentoa. SendAsNew avaa AlertDialogin.

## 5. Operaatiot

### OperationProgress

```text
OperationProgress {
  operationId, kindLabel, state, stages[], effects[], problem?,
  observationAge?, retryAvailability, closeLabel,
  onRetryFromFreshObservation, onClose
}
Stage = { id, label, state, detail?, facts[], problem? }
Effect = { kindLabel, stateLabel, description, ownerLabel? }
```

Stagejen järjestys tulee operationista; UI mapittaa tunnetun stage-ID:n suomenkieliseen
labeliin ja näyttää tuntemattoman ID:n turvallisena monotekstinä. Confirmed ei
muutu failediksi. Unknown, skipped ja pending ovat omat teksti-/ikoniyhdistelmänsä.
Partial-yhteenveto alkaa toteutuneista vaikutuksista ja jatkaa jääneisiin.
Retry näkyy vain valmiiksi johdetulla availabilityllä ja vaatii fresh observationin.

### CapabilityNotice

```text
CapabilityNotice { actionLabel, state: unsupported|unknown|temporarilyUnavailable,
                   reason, observedAt?, reobserveAction? }
```

Erottelee “ei tuettu” ja “ei vielä tiedossa”. Unknown ei lupaa, että toiminto
ilmestyy. Reobserve ei ole komennon retry.

### CreateWorkspaceDialog

```text
CreateWorkspaceDialog {
  mode: directory|git, name, displayName?,
  availability, validation, submission,
  operation?, onFieldChange, onSubmit, onClose
}
```

Loading capability, field errors, pending acceptance, running operation, partial,
failed ja success/created ovat erillisiä. Success navigation tapahtuu parentissa
snapshot-vahvistuksen jälkeen.

### GitIntegrationDialog

```text
GitIntegrationDialog {
  workspaceLabel, blocking, capabilities, operation?,
  facts[{repository,remote,transport,permissions,network}],
  onStart, onReobserve, onCloseWhenAllowed
}
```

Blocking-tila ei sulkeudu workspaceen. Facts voivat olla confirmed/absent/unknown/
unavailable/conflicting. Ei credential-syöttökenttää ilman myöhemmin hyväksyttyä
flow'ta.

### WorkspaceSettingsDialog

```text
WorkspaceSettingsDialog {
  displayName, nativeName, visibility, kind, mutationState,
  gitFacts, gitInitAvailability, saveState, visibilityCommandReceipt?,
  onDisplayNameChange, onVisibilityChange, onSave, onStartGitInit
}
```

`onSave` koskee vain display namea. `onVisibilityChange` lähettää erillisen
välittömän komennon ja näyttää oman receiptin; osatulosta ei yhdistetä saveen.
Valitun workspacen piilotus säilyttää reitin ja näyttää ilmoituksen. Ei runtime-,
model-, Git- tai credential-faktojen editointia. External change muuttaa
submissionin stale-tilaan ja vaatii reloadin.

### GitHubCreateDialog ja GitHubCloneDialog

```text
GitHubCreateDialog { owner, repository, visibility, confirmationChallenge?, confirmation,
                     capability, validation, operation?, onSubmit }
GitHubCloneDialog  { repository, targetName, transport,
                     capability, validation, operation?, onSubmit }
```

Unknown/unsupported on valmis read-only näkymä. Create-submit on disabled, kunnes
host antaa validoitavan confirmation challengen tai sopimus määrittää odotetun
arvon; deleten nimeä ei oleteta. Create ei yhdistä pushia onnistumiseksi; clone
partial näyttää syntyneen hakemiston effectinä.

### TaskfleetWorktreeDialog

```text
TaskfleetWorktreeDialog {
  sourceBranch, title, task, capability, validation, operation?, onSubmit
}
```

Ei mielivaltaista final branch/path -kenttää. Taskfleet omistaa tuloksen.
Non-Git/manual worktree näyttää CapabilityNotice-syyn eikä vaihtoehtoista Git-
toteutusta.

### ArchiveDialog

```text
ArchiveDialog {
  workspaceLabel, state, conversations[], operation?,
  onStopManaged, onArchive, onUnarchive, onResume
}
ArchiveItem = { agentId, title, nativeHistoryState, process, control,
                archivedAt?, actionAvailability }
```

Stop, archive annotation, unarchive ja resume ovat eri intenttejä/receiptejä.
Lista ei ole oma historia. Empty vain onnistuneesta native history + annotation
-havainnosta. Missing/corrupt history näkyy itemissä.

### TransferDialog

```text
TransferDialog {
  agentLabel, ownerPath: knownOwner|userTerminal,
  operation?, instructions?, transferAvailability,
  onBegin, onReobserve, onClose
}
```

Vaiheet ovat stop instruction/request, exited, history settled, lock, RPC start.
Unknown estää. Ei attach-, kill PID- tai force-toimintoa.

### DeleteWorkspaceDialog

```text
DeleteWorkspaceDialog {
  workspaceName, displayName?, preflightState, impacts[], confirmationValue,
  deleteAvailability, operation?, hideAvailability,
  onConfirmationChange, onDelete, onHideInstead, onReobserve
}
```

AlertDialog, alkuperäinen fokus Peruutassa. Impacts näyttää managed/observed
prosessit, Taskfleet ownershipin, manual/unknown worktreet, mountit ja unknownit.
Partial ei sulje dialogia automaattisesti. Delete success vain fresh absent
source-faktasta.

## 6. Esimerkkimatriisi toteutuskatalogille

Ensimmäisten storyjen vähimmäisjoukko:

| Komponentti/perhe | Pakolliset esimerkit |
|---|---|
| Primitives | light/dark, keyboard focus, disabled reason, pitkä label, reduced motion |
| WorkspaceRail | loading, confirmed empty, source missing, error, stale, filtered-empty, collapsed attention, pitkä nimi |
| AgentHeader/Facts | owned running, confirmed exited, terminal read-only, process unknown, title pending/failed |
| Timeline | empty, loading, long virtualized, paged accessible, stale, unknown event, anchor fallback |
| Message/Markdown | streaming, complete, error, hostile HTML/link fixture, long Finnish text |
| Tool | single, grouped running, grouped error closed, replacement stream, unknown tool, continued output |
| Code/Diff | highlighting pending/failed, content continuation, parsed edit, malformed diff, unified accessible |
| Question | input/select/confirm, pending, resolved elsewhere, unsupported |
| Composer/Queue | idle, steer/follow-up, whole-clear, disabled reason, rejected, uncertain send |
| Connection | reconnecting, stale, cursor expired/resnapshot, auth expired, daemon unavailable |
| OperationProgress | pending/running/succeeded/failed/unknown/skipped stages, partial residuals |
| Host dialogs | create partial, blocking Git unknown, GitHub unsupported, Taskfleet unknown, archive conflict, transfer blocked, delete blocked/partial |

Ajettava Storybook korvaa aiemman staattisen tuotantokierroksen. Se näyttää
integroidun perusnäkymän, stale/read-only-tilan, epävarman lähetyksen, osittaisen
operaation ja teemaparit samasta tuotantokoodista. Alkuperäiset toimitusvedokset
säilyvät vastaanottoissuessa historiallisena evidenssinä.
