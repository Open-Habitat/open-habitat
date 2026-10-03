---
created: 2026-09-21
updated: 2026-10-03
type: task
status: open
priority: normal
epic: native-agent-host-architecture
blocked_by: ['@unify-ui-primitives']
lane: post-mvp-design
lane_seq: 60
collision: [docs/, design-system/]
related: ['@consistent-control-feedback', '@restore-v2-navigation', '@design-control-states', '@apply-control-state-design']
---

# Design a consistent language for agent states

## Purpose

Help a person understand what an agent is doing and whether it needs attention,
wherever it appears. Jari's sidebar observations on 2 October 2026 raised a
usability question: which states matter, what they mean, and how the same meaning
is recognised across the agent list, sidebar and conversation.

## State meaning

Describe the user-facing states from current agent behavior, the facts available
from the host and observations of use. Process presence, activity, a request for
the person's attention and browser control answer different questions. A running
process alone does not establish that the agent is working, and losing contact
with it does not establish that it has stopped. Explain how the presentation
handles missing or stale information alongside the states it can establish.

For each proposed state, describe what it tells the person, which facts support
it and what the person can do about it. Identify missing information where a
useful distinction cannot yet be made. The current contracts and presentation
code are evidence for what is available; existing labels and symbols do not
define the intended meaning.

## Shared presentation and delivery

Prepare the meanings and representative examples for the agent-state chapter
of @design-control-states. Jari decided on 3 October 2026 that the designer
handles agent states in the same package as the shared controls' interaction
states. The designer develops one recognisable visual language for the agent
list, sidebar and conversation, including compact presentations. Text, symbols,
color and motion can work together; meaning remains available without relying
on color or animation alone. The existing dot treatments are reference material;
Jari left the state set and visual form open for this design work.

The result is a recommendation connecting each state to known facts and showing
how the designer's presentation works across views. @design-control-states owns
the package and design round. @apply-control-state-design implements the agreed
presentation through the shared `agentPresentation` mapping from host facts,
using the foundation from @unify-ui-primitives. Coordinate the examples with
@restore-v2-navigation and the conversation views so they use the same meanings.

## Decisions

### 2026-09-30T17:54:12Z · @claude

Rethink-night 30.9.: toteuttajalle suunnattu issue käytiin läpi rethink-instructions-skillillä (gpt-6-astra) ja faktantarkistettiin fact-check-instructions-skillillä (claude-opus-5-5). Teksti on jo selkeä ja riittävän tiivis, joten sitä ei muutettu. Ilman Jaria säilytettiin Jarin kirjaama post-MVP-suunnittelun rajaus, alkuperäinen statuspisteen hyväksyntä ja designin katselmointi ennen toteutusta; navigaatio-shellin synteettisiä kuvia ei tulkittu aidoksi moniagenttikäytön havainnoksi. Faktantarkistus ei löytänyt korjattavia väitteitä. @review-mvp suljettiin vanhentuneena, mutta issue vaatii edelleen havainnot todellisesta käytöstä; estettä, kaistaa ja Jarin päätöksiä ei muutettu. Ei ristiriitaa Jarin aiempien päätösten kanssa.

### 2026-10-02T10:05:17Z · @codex

Jari pyysi 2.10.2026 agenttien tiloista oman pienen käytettävyyssuunnittelun: mitä tiloja agentilla voi olla, miten niitä ilmaistaan ja miten yhtenäinen ilme kaikkialla auttaa käyttäjää ymmärtämään niitä. Hän tunnisti alustavasti aiemman tyhjä/vihreä/sykkivä-pistejaon, mutta ei lukinnut näitä tiloja tai esitystapaa. Tämä tarkentaa aiemman visuaalisen viimeistelyn tehtäväksi suunnitella tilojen merkitys ja johdonmukainen esitys. Käyttöliittymän toistuvien epäjohdonmukaisuuksien ohjelmistotekninen juurisyy kuuluu @consistent-control-feedback-issueen. Käytetään tätä olemassa olevaa issuea uuden päällekkäisen tehtävän sijasta.

### 2026-10-03T06:21:31Z · @claude

Jari 3.10.2026: agenttitilojen design viedään designerille samassa paketissa kuin primitiivien tilamatriisi (@design-control-states, StatusMark-luku). Toteutus eli yksi agentPresentation-funktio hostin faktoista kuuluu @apply-control-state-design-issueen ja edellyttää @unify-ui-primitives-pohjaa.
